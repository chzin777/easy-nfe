"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { emitirNota, type DescontoTipo, type EmitirResultado } from "@/app/notas/actions";

// ---- Tipos -----------------------------------------------------------------

export type StatusOrcamentoUI =
  | "rascunho" | "enviado" | "negociacao" | "aprovado" | "fechado" | "perdido" | "cancelado";

const STATUS_DB = {
  rascunho: "RASCUNHO", enviado: "ENVIADO", negociacao: "NEGOCIACAO",
  aprovado: "APROVADO", fechado: "FECHADO", perdido: "PERDIDO", cancelado: "CANCELADO",
} as const satisfies Record<StatusOrcamentoUI, string>;
const STATUS_UI: Record<string, StatusOrcamentoUI> = Object.fromEntries(
  Object.entries(STATUS_DB).map(([ui, db]) => [db, ui as StatusOrcamentoUI]),
) as Record<string, StatusOrcamentoUI>;

export type ItemOrcamentoInput = {
  produtoId: string;
  quantidade: number;
  descTipo: DescontoTipo;
  descValor: number;
};

export type OrcamentoInput = {
  clienteId: string;
  transportadoraId: string | null;
  tipoNota: string; // "55-saida" | "65-saida"
  modFrete: string;
  observacoes?: string;
  validade?: string | null; // ISO date (yyyy-mm-dd)
  desconto: { tipo: DescontoTipo; valor: number };
  itens: ItemOrcamentoInput[];
};

export type OrcamentoItemUI = {
  id: string;
  produtoId: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  descTipo: DescontoTipo;
  descValor: number;
  valorTotal: number;
};

export type OrcamentoCompleto = {
  id: string;
  numero: number;
  status: StatusOrcamentoUI;
  ordem: number;
  clienteId: string;
  clienteNome: string;
  transportadoraId: string | null;
  tipoNota: string;
  modFrete: string;
  observacoes: string;
  validade: string | null;
  motivoPerda: string | null;
  desconto: { tipo: DescontoTipo; valor: number };
  valorTotal: number;
  notaId: string | null;
  criadoEm: string;
  itens: OrcamentoItemUI[];
};

// ---- Helpers ---------------------------------------------------------------

// Desconto sobre uma base (R$ ou %), limitado ao próprio valor.
function calcDesc(base: number, tipo: DescontoTipo, valor: number): number {
  if (!valor || valor <= 0) return 0;
  const v = tipo === "percent" ? (base * valor) / 100 : valor;
  return Math.min(Math.max(v, 0), base);
}

// Total líquido do orçamento (itens com desconto + desconto geral rateado).
function calcTotais(itens: { qtd: number; preco: number; descTipo: DescontoTipo; descValor: number }[], descGeral: { tipo: DescontoTipo; valor: number }) {
  const liquidoItens = itens.reduce((s, i) => {
    const bruto = i.qtd * i.preco;
    return s + (bruto - calcDesc(bruto, i.descTipo, i.descValor));
  }, 0);
  const geral = calcDesc(liquidoItens, descGeral.tipo, descGeral.valor);
  return Math.round((liquidoItens - geral) * 100) / 100;
}

type OrcRow = {
  id: string; numero: number; status: string; ordem: number;
  clienteId: string; transportadoraId: string | null; tipoNota: string; modFrete: string;
  observacoes: string | null; validade: Date | null; motivoPerda: string | null;
  descontoTipo: string; descontoValor: unknown; valorTotal: unknown; notaId: string | null;
  criadoEm: Date; cliente: { nome: string };
  itens: { id: string; produtoId: string | null; nome: string; unidade: string | null; quantidade: unknown; precoUnitario: unknown; descontoTipo: string; descontoValor: unknown; valorTotal: unknown }[];
};

function paraUI(o: OrcRow): OrcamentoCompleto {
  return {
    id: o.id, numero: o.numero, status: STATUS_UI[o.status] ?? "rascunho", ordem: o.ordem,
    clienteId: o.clienteId, clienteNome: o.cliente.nome, transportadoraId: o.transportadoraId,
    tipoNota: o.tipoNota, modFrete: o.modFrete, observacoes: o.observacoes ?? "",
    validade: o.validade ? o.validade.toISOString().slice(0, 10) : null,
    motivoPerda: o.motivoPerda,
    desconto: { tipo: (o.descontoTipo as DescontoTipo) || "valor", valor: Number(o.descontoValor) },
    valorTotal: Number(o.valorTotal), notaId: o.notaId, criadoEm: o.criadoEm.toISOString(),
    itens: o.itens.map((i) => ({
      id: i.id, produtoId: i.produtoId, nome: i.nome, unidade: i.unidade ?? "UN",
      quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario),
      descTipo: (i.descontoTipo as DescontoTipo) || "valor", descValor: Number(i.descontoValor),
      valorTotal: Number(i.valorTotal),
    })),
  };
}

const INCLUDE = { cliente: { select: { nome: true } }, itens: true } as const;

// Monta os dados de itens (snapshot dos produtos) + total, validando produtos.
async function montarItens(empresaId: string, itens: ItemOrcamentoInput[]) {
  const ids = itens.map((i) => i.produtoId);
  const produtos = await prisma.produto.findMany({ where: { empresaId, id: { in: ids } } });
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const linhas = itens
    .filter((i) => porId.has(i.produtoId) && i.quantidade > 0)
    .map((i) => {
      const p = porId.get(i.produtoId)!;
      const preco = Number(p.preco);
      const bruto = i.quantidade * preco;
      const total = Math.round((bruto - calcDesc(bruto, i.descTipo, i.descValor)) * 100) / 100;
      return {
        produtoId: p.id, nome: p.nome, ncm: p.ncm, cfop: p.cfopPadrao || "5102",
        unidade: p.unidade, quantidade: i.quantidade, precoUnitario: preco,
        descontoTipo: i.descTipo, descontoValor: i.descValor, valorTotal: total,
      };
    });
  return linhas;
}

// ---- Actions ---------------------------------------------------------------

export async function listarOrcamentos(): Promise<OrcamentoCompleto[]> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const rows = await prisma.orcamento.findMany({
    where: { emitenteId: empresaId },
    orderBy: [{ status: "asc" }, { ordem: "asc" }, { numero: "desc" }],
    include: INCLUDE,
  });
  return rows.map(paraUI);
}

export async function obterOrcamento(id: string): Promise<OrcamentoCompleto | null> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const o = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, include: INCLUDE });
  return o ? paraUI(o) : null;
}

export async function criarOrcamento(input: OrcamentoInput): Promise<OrcamentoCompleto> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const linhas = await montarItens(empresaId, input.itens);
  if (!linhas.length) throw new Error("Adicione ao menos um produto ao orçamento.");
  const total = calcTotais(linhas.map((l) => ({ qtd: l.quantidade, preco: l.precoUnitario, descTipo: l.descontoTipo, descValor: l.descontoValor })), input.desconto);

  const ult = await prisma.orcamento.findFirst({ where: { emitenteId: empresaId }, orderBy: { numero: "desc" }, select: { numero: true } });
  const numero = (ult?.numero ?? 0) + 1;

  const o = await prisma.orcamento.create({
    data: {
      numero, emitenteId: empresaId, clienteId: input.clienteId,
      transportadoraId: input.transportadoraId || null, tipoNota: input.tipoNota, modFrete: input.modFrete,
      observacoes: input.observacoes || null, validade: input.validade ? new Date(input.validade) : null,
      descontoTipo: input.desconto.tipo, descontoValor: input.desconto.valor,
      valorTotal: total, status: "RASCUNHO",
      itens: { create: linhas },
    },
    include: INCLUDE,
  });
  return paraUI(o);
}

export async function atualizarOrcamento(id: string, input: OrcamentoInput): Promise<OrcamentoCompleto> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const atual = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, select: { status: true } });
  if (!atual) throw new Error("Orçamento não encontrado.");
  if (atual.status === "FECHADO") throw new Error("Orçamento já virou nota — não pode ser editado.");

  const linhas = await montarItens(empresaId, input.itens);
  if (!linhas.length) throw new Error("Adicione ao menos um produto ao orçamento.");
  const total = calcTotais(linhas.map((l) => ({ qtd: l.quantidade, preco: l.precoUnitario, descTipo: l.descontoTipo, descValor: l.descontoValor })), input.desconto);

  // Substitui os itens (snapshot).
  await prisma.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
  const o = await prisma.orcamento.update({
    where: { id },
    data: {
      clienteId: input.clienteId, transportadoraId: input.transportadoraId || null,
      tipoNota: input.tipoNota, modFrete: input.modFrete, observacoes: input.observacoes || null,
      validade: input.validade ? new Date(input.validade) : null,
      descontoTipo: input.desconto.tipo, descontoValor: input.desconto.valor, valorTotal: total,
      itens: { create: linhas },
    },
    include: INCLUDE,
  });
  return paraUI(o);
}

// Move o orçamento no funil (kanban). Bloqueia mover p/ FECHADO manualmente
// (fechar é via converterEmNota) e mexer em orçamento já fechado.
export async function moverStatus(id: string, status: StatusOrcamentoUI, ordem?: number): Promise<void> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  if (status === "fechado") throw new Error('Use "Fechar venda" para gerar a NF e fechar o orçamento.');
  const atual = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, select: { status: true } });
  if (!atual) throw new Error("Orçamento não encontrado.");
  if (atual.status === "FECHADO") throw new Error("Orçamento já fechado (virou nota).");
  await prisma.orcamento.updateMany({
    where: { id, emitenteId: empresaId },
    data: { status: STATUS_DB[status], ...(ordem != null ? { ordem } : {}) },
  });
}

export async function cancelarOrcamento(id: string): Promise<void> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const atual = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, select: { status: true } });
  if (!atual) throw new Error("Orçamento não encontrado.");
  if (atual.status === "FECHADO") throw new Error("Orçamento já virou nota — não pode ser cancelado aqui.");
  await prisma.orcamento.updateMany({ where: { id, emitenteId: empresaId }, data: { status: "CANCELADO" } });
}

export async function marcarPerdido(id: string, motivo: string): Promise<void> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  await prisma.orcamento.updateMany({
    where: { id, emitenteId: empresaId, status: { not: "FECHADO" } },
    data: { status: "PERDIDO", motivoPerda: motivo || null },
  });
}

export async function excluirOrcamento(id: string): Promise<void> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  // Não exclui o que já virou nota (mantém o vínculo fiscal).
  await prisma.orcamento.deleteMany({ where: { id, emitenteId: empresaId, status: { not: "FECHADO" } } });
}

// Fecha a venda: emite a NF a partir do orçamento e marca como FECHADO.
// Reaproveita toda a emissão (emitirNota). Só fecha o orçamento se autorizar.
export async function converterEmNota(id: string): Promise<EmitirResultado> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const o = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, include: { itens: true } });
  if (!o) return { ok: false, erro: "Orçamento não encontrado." };
  if (o.status === "FECHADO") return { ok: false, erro: "Este orçamento já virou nota." };

  const itens = o.itens
    .filter((i) => i.produtoId)
    .map((i) => ({
      produtoId: i.produtoId as string,
      quantidade: Number(i.quantidade),
      descTipo: (i.descontoTipo as DescontoTipo) || "valor",
      descValor: Number(i.descontoValor),
    }));
  if (!itens.length) return { ok: false, erro: "Orçamento sem produtos válidos para emitir." };

  const r = await emitirNota({
    clienteId: o.clienteId,
    transportadoraId: o.transportadoraId,
    tipoNota: o.tipoNota,
    modFrete: o.modFrete,
    infCpl: o.observacoes ?? undefined,
    itens,
    descontoNota: { tipo: (o.descontoTipo as DescontoTipo) || "valor", valor: Number(o.descontoValor) },
  });

  if (r.ok && r.autorizada && r.notaId) {
    await prisma.orcamento.update({ where: { id }, data: { status: "FECHADO", notaId: r.notaId } });
  }
  return r;
}
