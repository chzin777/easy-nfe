"use server";

import { prisma } from "@/lib/prisma";
import { empresaAtivaId } from "@/lib/empresa";

export type ResumoDashboard = {
  produtos: number;
  clientes: number;
  transportadoras: number;
  notasAutorizadas: number;
  faturado: number;
  // Indicadores financeiros (dependem do preço de custo dos produtos).
  cmv: number; // custo da mercadoria vendida (Σ qtd × custo, só itens com custo)
  receitaComCusto: number; // receita dos itens que têm custo cadastrado
  lucroBruto: number; // receitaComCusto − cmv
  margem: number; // lucroBruto / receitaComCusto × 100
  ticketMedio: number; // faturado / notasAutorizadas
  itensSemCusto: number; // itens vendidos sem custo cadastrado (lucro não apurado)
  valorEstoqueCusto: number; // Σ saldo × custo (produtos que controlam estoque)
  valorEstoqueVenda: number; // Σ saldo × preço de venda
  topProdutosLucro: { nome: string; lucro: number; receita: number }[];
  recentes: {
    id: string;
    numero: number;
    clienteNome: string;
    tipoNota: string;
    emitidaEm: string;
    valorTotal: number;
    status: "autorizada" | "rascunho" | "cancelada" | "rejeitada" | "denegada";
  }[];
  serieMensal: { mes: string; notas: number; faturado: number; lucro: number }[];
  distribuicaoStatus: { status: string; qtd: number }[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const STATUS_UI: Record<string, ResumoDashboard["recentes"][number]["status"]> = {
  RASCUNHO: "rascunho", AUTORIZADA: "autorizada", CANCELADA: "cancelada",
  REJEITADA: "rejeitada", DENEGADA: "denegada",
};

const RESUMO_VAZIO: ResumoDashboard = {
  produtos: 0, clientes: 0, transportadoras: 0, notasAutorizadas: 0, faturado: 0,
  cmv: 0, receitaComCusto: 0, lucroBruto: 0, margem: 0, ticketMedio: 0, itensSemCusto: 0,
  valorEstoqueCusto: 0, valorEstoqueVenda: 0, topProdutosLucro: [],
  recentes: [], serieMensal: [], distribuicaoStatus: [],
};

export type PeriodoFiltro = "30d" | "90d" | "6m" | "12m" | "ano" | "tudo";
export type FiltrosDashboard = { periodo?: PeriodoFiltro; modelo?: "" | "55" | "65" };

// Data inicial do período + quantos meses cobrir na série temporal.
function janelaPeriodo(periodo: PeriodoFiltro, agora: Date): { inicio: Date | null; meses: number } {
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  switch (periodo) {
    case "30d": return { inicio: new Date(agora.getTime() - 30 * 864e5), meses: 6 };
    case "90d": return { inicio: new Date(agora.getTime() - 90 * 864e5), meses: 6 };
    case "12m": return { inicio: new Date(ano, mes - 11, 1), meses: 12 };
    case "ano": return { inicio: new Date(ano, 0, 1), meses: mes + 1 };
    case "tudo": return { inicio: null, meses: 12 };
    case "6m":
    default: return { inicio: new Date(ano, mes - 5, 1), meses: 6 };
  }
}

export async function resumoDashboard(filtros: FiltrosDashboard = {}): Promise<ResumoDashboard> {
  try {
    return await resumoInterno(filtros);
  } catch {
    // Nunca derruba o render do painel por falha de consulta.
    return RESUMO_VAZIO;
  }
}

async function resumoInterno(filtros: FiltrosDashboard): Promise<ResumoDashboard> {
  const empresaId = await empresaAtivaId();
  if (!empresaId) return RESUMO_VAZIO;

  const periodo = filtros.periodo ?? "6m";
  const modelo = filtros.modelo || undefined;
  const agora = new Date();
  const { inicio, meses } = janelaPeriodo(periodo, agora);

  // Filtro comum a todas as métricas sensíveis a período/modelo.
  const wherePeriodo = {
    emitenteId: empresaId,
    ...(modelo ? { modelo } : {}),
    ...(inicio ? { emitidaEm: { gte: inicio } } : {}),
  };
  // Janela da série temporal (sempre cobre os `meses` buckets exibidos).
  const inicioJanela = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1);

  // Itens vendidos (autorizados) no período — base do custo/lucro. Só itens com
  // produto vinculado têm custo; o snapshot de preço vem do próprio item.
  const whereItensAutorizados = (desde: Date | null) => ({
    produtoId: { not: null },
    nota: {
      emitenteId: empresaId,
      status: "AUTORIZADA" as const,
      ...(modelo ? { modelo } : {}),
      ...(desde ? { emitidaEm: { gte: desde } } : {}),
    },
  });

  const [produtos, clientes, transportadoras, autorizadas, agg, recentesRows, porStatus, notasJanela, itensPeriodo, itensJanela, produtosEstoque] = await Promise.all([
    prisma.produto.count({ where: { empresaId } }),
    prisma.cliente.count({ where: { empresaId } }),
    prisma.transportadora.count({ where: { empresaId } }),
    prisma.nota.count({ where: { ...wherePeriodo, status: "AUTORIZADA" } }),
    prisma.nota.aggregate({
      where: { ...wherePeriodo, status: "AUTORIZADA" },
      _sum: { valorTotal: true },
    }),
    prisma.nota.findMany({
      where: wherePeriodo,
      orderBy: { emitidaEm: "desc" },
      take: 5,
      include: { cliente: true },
    }),
    prisma.nota.groupBy({
      by: ["status"],
      where: wherePeriodo,
      _count: { _all: true },
    }),
    prisma.nota.findMany({
      where: { emitenteId: empresaId, ...(modelo ? { modelo } : {}), emitidaEm: { gte: inicioJanela } },
      select: { emitidaEm: true, valorTotal: true, status: true },
    }),
    prisma.itemNota.findMany({
      where: whereItensAutorizados(inicio),
      select: { quantidade: true, valorTotal: true, nome: true, produto: { select: { nome: true, precoCusto: true } } },
    }),
    prisma.itemNota.findMany({
      where: whereItensAutorizados(inicioJanela),
      select: { quantidade: true, valorTotal: true, produto: { select: { precoCusto: true } }, nota: { select: { emitidaEm: true } } },
    }),
    prisma.produto.findMany({
      where: { empresaId, controlaEstoque: true },
      select: { estoque: true, preco: true, precoCusto: true },
    }),
  ]);

  // Buckets dos últimos N meses.
  const buckets: { mes: string; chave: string; notas: number; faturado: number; lucro: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    buckets.push({ mes: MESES[d.getMonth()], chave: `${d.getFullYear()}-${d.getMonth()}`, notas: 0, faturado: 0, lucro: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.chave, i]));
  for (const n of notasJanela) {
    const d = n.emitidaEm;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(k);
    if (i === undefined) continue;
    buckets[i].notas += 1;
    if (n.status === "AUTORIZADA") buckets[i].faturado += Number(n.valorTotal);
  }
  // Lucro por mês: receita do item − (qtd × custo), só itens com custo cadastrado.
  for (const it of itensJanela) {
    const custoUnit = it.produto?.precoCusto == null ? null : Number(it.produto.precoCusto);
    if (custoUnit == null || custoUnit <= 0) continue;
    const d = it.nota.emitidaEm;
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i === undefined) continue;
    buckets[i].lucro += Number(it.valorTotal) - Number(it.quantidade) * custoUnit;
  }

  // Custo / lucro do período + top produtos por lucro.
  let cmv = 0, receitaComCusto = 0, itensSemCusto = 0;
  const lucroPorProduto = new Map<string, { nome: string; lucro: number; receita: number }>();
  for (const it of itensPeriodo) {
    const receita = Number(it.valorTotal);
    const custoUnit = it.produto?.precoCusto == null ? null : Number(it.produto.precoCusto);
    if (custoUnit == null || custoUnit <= 0) { itensSemCusto++; continue; }
    const custo = Number(it.quantidade) * custoUnit;
    const lucro = receita - custo;
    cmv += custo;
    receitaComCusto += receita;
    const nome = it.produto?.nome ?? it.nome;
    const acc = lucroPorProduto.get(nome) ?? { nome, lucro: 0, receita: 0 };
    acc.lucro += lucro;
    acc.receita += receita;
    lucroPorProduto.set(nome, acc);
  }
  const lucroBruto = receitaComCusto - cmv;
  const margem = receitaComCusto > 0 ? (lucroBruto / receitaComCusto) * 100 : 0;
  const topProdutosLucro = [...lucroPorProduto.values()].sort((a, b) => b.lucro - a.lucro).slice(0, 6);

  // Valor do estoque atual (custo x venda) — só produtos que controlam estoque.
  let valorEstoqueCusto = 0, valorEstoqueVenda = 0;
  for (const p of produtosEstoque) {
    const q = Number(p.estoque);
    if (q <= 0) continue;
    valorEstoqueVenda += q * Number(p.preco);
    if (p.precoCusto != null) valorEstoqueCusto += q * Number(p.precoCusto);
  }

  const faturado = Number(agg._sum.valorTotal ?? 0);

  return {
    serieMensal: buckets.map((b) => ({ mes: b.mes, notas: b.notas, faturado: b.faturado, lucro: b.lucro })),
    distribuicaoStatus: porStatus.map((s) => ({ status: STATUS_UI[s.status] ?? "rascunho", qtd: s._count._all })),
    produtos,
    clientes,
    transportadoras,
    notasAutorizadas: autorizadas,
    faturado,
    cmv,
    receitaComCusto,
    lucroBruto,
    margem,
    ticketMedio: autorizadas > 0 ? faturado / autorizadas : 0,
    itensSemCusto,
    valorEstoqueCusto,
    valorEstoqueVenda,
    topProdutosLucro,
    recentes: recentesRows.map((n) => ({
      id: n.id,
      numero: n.numero,
      clienteNome: n.cliente.nome,
      tipoNota: n.tipoNota,
      emitidaEm: n.emitidaEm.toISOString(),
      valorTotal: Number(n.valorTotal),
      status: STATUS_UI[n.status] ?? "rascunho",
    })),
  };
}
