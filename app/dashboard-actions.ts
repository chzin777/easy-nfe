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
  // Mesmas métricas no período imediatamente anterior, de mesma duração —
  // um KPI sem comparação não diz se o número é bom ou ruim.
  anterior: { faturado: number; lucro: number; notas: number; ticketMedio: number };
  // Qualidade da emissão: quanto do que foi enviado à SEFAZ passou.
  emitidasNoPeriodo: number;
  taxaAprovacao: number; // autorizadas / emitidas × 100
  // Faturamento por modelo de documento (NF-e 55 x NFC-e 65).
  porModelo: { modelo: string; qtd: number; faturado: number }[];
  topClientes: { nome: string; faturado: number; notas: number }[];
  // Venda sem nota (módulo /vendas) — receita que não aparece no faturamento fiscal.
  vendasSemNota: { qtd: number; total: number };
  // Fiado em aberto (caderneta): débitos − créditos, saldo devedor total.
  fiadoEmAberto: { saldo: number; clientes: number };
  // Produtos no ou abaixo do mínimo — lista acionável, não só um número.
  estoqueCritico: { nome: string; saldo: number; minimo: number }[];
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
  anterior: { faturado: 0, lucro: 0, notas: 0, ticketMedio: 0 },
  emitidasNoPeriodo: 0, taxaAprovacao: 0, porModelo: [], topClientes: [],
  vendasSemNota: { qtd: 0, total: 0 },
  fiadoEmAberto: { saldo: 0, clientes: 0 },
  estoqueCritico: [],
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

  // Período imediatamente anterior, de mesma duração — base da comparação.
  // Em "tudo" não existe anterior: a comparação fica zerada de propósito.
  const janelaAnterior = inicio
    ? { de: new Date(inicio.getTime() - (agora.getTime() - inicio.getTime())), ate: inicio }
    : null;
  const wherePeriodoAnterior = janelaAnterior
    ? {
        emitenteId: empresaId,
        ...(modelo ? { modelo } : {}),
        emitidaEm: { gte: janelaAnterior.de, lt: janelaAnterior.ate },
      }
    : null;

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

  const [
    produtos, clientes, transportadoras, autorizadas, agg, recentesRows, porStatus,
    notasJanela, itensPeriodo, itensJanela, produtosEstoque,
    aggAnterior, itensAnterior, porModeloRows, topClientesRows, aggVendas, fiadoRows, produtosMinimo,
  ] = await Promise.all([
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
    // --- Comparação com o período anterior ---
    wherePeriodoAnterior
      ? prisma.nota.aggregate({
          where: { ...wherePeriodoAnterior, status: "AUTORIZADA" },
          _sum: { valorTotal: true },
          _count: { _all: true },
        })
      : null,
    janelaAnterior
      ? prisma.itemNota.findMany({
          where: {
            produtoId: { not: null },
            nota: {
              emitenteId: empresaId,
              status: "AUTORIZADA" as const,
              ...(modelo ? { modelo } : {}),
              emitidaEm: { gte: janelaAnterior.de, lt: janelaAnterior.ate },
            },
          },
          select: { quantidade: true, valorTotal: true, produto: { select: { precoCusto: true } } },
        })
      : null,
    // Faturamento e volume por modelo de documento.
    prisma.nota.groupBy({
      by: ["modelo"],
      where: { ...wherePeriodo, status: "AUTORIZADA" },
      _sum: { valorTotal: true },
      _count: { _all: true },
    }),
    // Top clientes por faturamento no período.
    prisma.nota.groupBy({
      by: ["clienteId"],
      where: { ...wherePeriodo, status: "AUTORIZADA" },
      _sum: { valorTotal: true },
      _count: { _all: true },
      orderBy: { _sum: { valorTotal: "desc" } },
      take: 6,
    }),
    // Venda sem nota concluída no período (receita fora do faturamento fiscal).
    prisma.venda.aggregate({
      where: { empresaId, status: "CONCLUIDA", ...(inicio ? { data: { gte: inicio } } : {}) },
      _sum: { valorTotal: true },
      _count: { _all: true },
    }),
    // Caderneta: saldo devedor por tipo de lançamento (todo o histórico — dívida
    // não "expira" no fim do período escolhido).
    prisma.lancamentoFiado.groupBy({
      by: ["tipo", "clienteId"],
      where: { empresaId },
      _sum: { valor: true },
    }),
    // Produtos no ou abaixo do mínimo. Sem mínimo cadastrado não há alerta.
    prisma.produto.findMany({
      where: { empresaId, controlaEstoque: true, estoqueMinimo: { gt: 0 } },
      select: { nome: true, estoque: true, estoqueMinimo: true },
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

  // Período anterior — mesma regra de lucro (só itens com custo cadastrado).
  const faturadoAnterior = Number(aggAnterior?._sum.valorTotal ?? 0);
  const notasAnterior = aggAnterior?._count._all ?? 0;
  let lucroAnterior = 0;
  for (const it of itensAnterior ?? []) {
    const custoUnit = it.produto?.precoCusto == null ? null : Number(it.produto.precoCusto);
    if (custoUnit == null || custoUnit <= 0) continue;
    lucroAnterior += Number(it.valorTotal) - Number(it.quantidade) * custoUnit;
  }

  // Taxa de aprovação: das notas que chegaram à SEFAZ, quantas passaram.
  // Rascunho fica de fora — nunca foi transmitido, não é acerto nem erro.
  const contagemPorStatus = new Map(porStatus.map((s) => [s.status, s._count._all]));
  const transmitidas =
    (contagemPorStatus.get("AUTORIZADA") ?? 0) +
    (contagemPorStatus.get("REJEITADA") ?? 0) +
    (contagemPorStatus.get("DENEGADA") ?? 0) +
    (contagemPorStatus.get("CANCELADA") ?? 0);
  const taxaAprovacao = transmitidas > 0
    ? (((contagemPorStatus.get("AUTORIZADA") ?? 0) + (contagemPorStatus.get("CANCELADA") ?? 0)) / transmitidas) * 100
    : 0;

  // Nome do cliente para o ranking (o groupBy só devolve o id).
  const idsTop = topClientesRows.map((r) => r.clienteId).filter((id): id is string => !!id);
  const nomesClientes = idsTop.length
    ? new Map(
        (await prisma.cliente.findMany({ where: { id: { in: idsTop } }, select: { id: true, nome: true } }))
          .map((c) => [c.id, c.nome]),
      )
    : new Map<string, string>();

  // Saldo devedor da caderneta: débitos − créditos por cliente. Só quem ainda
  // deve entra na conta (crédito a mais não vira saldo negativo da empresa).
  const saldoPorCliente = new Map<string, number>();
  for (const r of fiadoRows) {
    const v = Number(r._sum.valor ?? 0);
    const atual = saldoPorCliente.get(r.clienteId) ?? 0;
    saldoPorCliente.set(r.clienteId, atual + (r.tipo === "DEBITO" ? v : -v));
  }
  let fiadoSaldo = 0, fiadoClientes = 0;
  for (const saldo of saldoPorCliente.values()) {
    if (saldo > 0.005) { fiadoSaldo += saldo; fiadoClientes++; }
  }

  const estoqueCritico = produtosMinimo
    .map((p) => ({ nome: p.nome, saldo: Number(p.estoque), minimo: Number(p.estoqueMinimo) }))
    .filter((p) => p.saldo <= p.minimo)
    .sort((a, b) => a.saldo - b.saldo || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 8);

  return {
    anterior: {
      faturado: faturadoAnterior,
      lucro: lucroAnterior,
      notas: notasAnterior,
      ticketMedio: notasAnterior > 0 ? faturadoAnterior / notasAnterior : 0,
    },
    emitidasNoPeriodo: transmitidas,
    taxaAprovacao,
    porModelo: porModeloRows.map((r) => ({
      modelo: r.modelo,
      qtd: r._count._all,
      faturado: Number(r._sum.valorTotal ?? 0),
    })),
    topClientes: topClientesRows.map((r) => ({
      nome: (r.clienteId && nomesClientes.get(r.clienteId)) || "—",
      faturado: Number(r._sum.valorTotal ?? 0),
      notas: r._count._all,
    })).filter((c) => c.faturado > 0),
    vendasSemNota: {
      qtd: aggVendas._count._all,
      total: Number(aggVendas._sum.valorTotal ?? 0),
    },
    fiadoEmAberto: { saldo: fiadoSaldo, clientes: fiadoClientes },
    estoqueCritico,
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
