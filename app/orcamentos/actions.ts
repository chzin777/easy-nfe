"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { emitirNota, type DescontoTipo, type EmitirResultado } from "@/app/notas/actions";
import { emitirParaEmpresa } from "@/lib/nfse/emitir";

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

// Um item é de produto (NF-e/NFC-e) ou de serviço (NFS-e) — nunca dos dois.
// Qual dos dois vale é decidido pelo tipoNota do orçamento.
// precoUnitario: preço praticado neste orçamento. Ausente (ou <= 0) usa o do
// cadastro — igual à emissão de nota, onde o cadastro é só o ponto de partida.
export type ItemOrcamentoInput = {
  produtoId?: string;
  servicoId?: string;
  quantidade: number;
  precoUnitario?: number;
  descTipo: DescontoTipo;
  descValor: number;
};

// Orçamento de serviço: fecha em NFS-e em vez de NF-e. O valor também vive em
// lib/tipos-nota.ts, que é de onde a tela lê (um "use server" não exporta
// constante).
const TIPO_SERVICO = "nfse";

export type OrcamentoInput = {
  clienteId: string;
  transportadoraId: string | null;
  tipoNota: string; // "55-saida" | "65-saida" | "nfse"
  modFrete: string;
  observacoes?: string;
  validade?: string | null; // ISO date (yyyy-mm-dd)
  desconto: { tipo: DescontoTipo; valor: number };
  itens: ItemOrcamentoInput[];
};

export type OrcamentoItemUI = {
  id: string;
  produtoId: string | null;
  servicoId: string | null;
  notaServicoId: string | null;
  descricao: string;
  cTribNac: string;
  aliqISS: number;
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
  clienteDocumento: string; // CPF ou CNPJ, só dígitos (vazio no consumidor final)
  clienteTelefone: string;
  clienteEmail: string;
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
  criadoEm: Date; cliente: { nome: string; documento: string; telefone: string | null; email: string | null };
  itens: { id: string; produtoId: string | null; servicoId: string | null; notaServicoId: string | null; descricao: string | null; cTribNac: string | null; aliqISS: unknown; nome: string; unidade: string | null; quantidade: unknown; precoUnitario: unknown; descontoTipo: string; descontoValor: unknown; valorTotal: unknown }[];
};

function paraUI(o: OrcRow): OrcamentoCompleto {
  return {
    id: o.id, numero: o.numero, status: STATUS_UI[o.status] ?? "rascunho", ordem: o.ordem,
    clienteId: o.clienteId, clienteNome: o.cliente.nome, clienteDocumento: o.cliente.documento,
    clienteTelefone: o.cliente.telefone ?? "", clienteEmail: o.cliente.email ?? "",
    transportadoraId: o.transportadoraId,
    tipoNota: o.tipoNota, modFrete: o.modFrete, observacoes: o.observacoes ?? "",
    validade: o.validade ? o.validade.toISOString().slice(0, 10) : null,
    motivoPerda: o.motivoPerda,
    desconto: { tipo: (o.descontoTipo as DescontoTipo) || "valor", valor: Number(o.descontoValor) },
    valorTotal: Number(o.valorTotal), notaId: o.notaId, criadoEm: o.criadoEm.toISOString(),
    itens: o.itens.map((i) => ({
      id: i.id, produtoId: i.produtoId, servicoId: i.servicoId,
      notaServicoId: i.notaServicoId, descricao: i.descricao ?? "",
      cTribNac: i.cTribNac ?? "", aliqISS: i.aliqISS == null ? 0 : Number(i.aliqISS),
      nome: i.nome, unidade: i.unidade ?? "UN",
      quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario),
      descTipo: (i.descontoTipo as DescontoTipo) || "valor", descValor: Number(i.descontoValor),
      valorTotal: Number(i.valorTotal),
    })),
  };
}

const INCLUDE = {
  cliente: { select: { nome: true, documento: true, telefone: true, email: true } },
  itens: true,
} as const;

// Linha gravada no orçamento — o mesmo formato para produto e para serviço.
type LinhaItem = {
  produtoId?: string; servicoId?: string;
  nome: string; ncm?: string | null; cfop?: string | null; unidade?: string | null;
  descricao?: string | null; cTribNac?: string | null; itemListaServico?: string | null;
  cNBS?: string | null; aliqISS?: number | null;
  quantidade: number; precoUnitario: number;
  descontoTipo: DescontoTipo; descontoValor: number; valorTotal: number;
};

const totalLinha = (qtd: number, preco: number, tipo: DescontoTipo, valor: number) =>
  Math.round((qtd * preco - calcDesc(qtd * preco, tipo, valor)) * 100) / 100;

// Preço da linha: o informado na tela, se veio; senão o do cadastro.
const precoDoItem = (i: ItemOrcamentoInput, cadastro: number) =>
  typeof i.precoUnitario === "number" && Number.isFinite(i.precoUnitario) && i.precoUnitario > 0
    ? Number(i.precoUnitario.toFixed(2))
    : cadastro;

// Monta os dados de itens (snapshot dos produtos) + total, validando produtos.
async function montarItens(empresaId: string, itens: ItemOrcamentoInput[]): Promise<LinhaItem[]> {
  const ids = itens.map((i) => i.produtoId).filter(Boolean) as string[];
  const produtos = await prisma.produto.findMany({ where: { empresaId, id: { in: ids } } });
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return itens
    .filter((i) => i.produtoId && porId.has(i.produtoId) && i.quantidade > 0)
    .map((i) => {
      const p = porId.get(i.produtoId!)!;
      const preco = precoDoItem(i, Number(p.preco));
      return {
        produtoId: p.id, nome: p.nome, ncm: p.ncm, cfop: p.cfopPadrao || "5102",
        unidade: p.unidade, quantidade: i.quantidade, precoUnitario: preco,
        descontoTipo: i.descTipo, descontoValor: i.descValor,
        valorTotal: totalLinha(i.quantidade, preco, i.descTipo, i.descValor),
      };
    });
}

// Mesma coisa para orçamento de serviço: o snapshot vem do catálogo de
// serviços e guarda a classificação que a NFS-e vai exigir na hora de fechar.
async function montarItensServico(empresaId: string, itens: ItemOrcamentoInput[]): Promise<LinhaItem[]> {
  const ids = itens.map((i) => i.servicoId).filter(Boolean) as string[];
  const servicos = await prisma.servico.findMany({ where: { empresaId, id: { in: ids } } });
  const porId = new Map(servicos.map((s) => [s.id, s]));
  return itens
    .filter((i) => i.servicoId && porId.has(i.servicoId) && i.quantidade > 0)
    .map((i) => {
      const s = porId.get(i.servicoId!)!;
      const preco = precoDoItem(i, Number(s.valorUnit));
      return {
        servicoId: s.id, nome: s.nome, unidade: "UN",
        descricao: s.descricao || s.nome,
        cTribNac: s.cTribNac, itemListaServico: s.itemListaServico, cNBS: s.cNBS,
        aliqISS: s.aliqISS == null ? null : Number(s.aliqISS),
        quantidade: i.quantidade, precoUnitario: preco,
        descontoTipo: i.descTipo, descontoValor: i.descValor,
        valorTotal: totalLinha(i.quantidade, preco, i.descTipo, i.descValor),
      };
    });
}

// Escolhe o catálogo certo pelo modelo escolhido no orçamento.
async function montarLinhas(empresaId: string, input: OrcamentoInput): Promise<LinhaItem[]> {
  return input.tipoNota === TIPO_SERVICO
    ? montarItensServico(empresaId, input.itens)
    : montarItens(empresaId, input.itens);
}

const SEM_ITEM = (tipoNota: string) =>
  tipoNota === TIPO_SERVICO
    ? "Adicione ao menos um serviço ao orçamento."
    : "Adicione ao menos um produto ao orçamento.";

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
  const linhas = await montarLinhas(empresaId, input);
  if (!linhas.length) throw new Error(SEM_ITEM(input.tipoNota));
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
  const atual = await prisma.orcamento.findFirst({
    where: { id, emitenteId: empresaId },
    select: { status: true, itens: { select: { notaServicoId: true } } },
  });
  if (!atual) throw new Error("Orçamento não encontrado.");
  if (atual.status === "FECHADO") throw new Error("Orçamento já virou nota — não pode ser editado.");
  // Fechamento de serviço emite uma NFS-e por linha e pode parar no meio.
  // Trocar os itens depois disso soltaria as notas já emitidas.
  if (atual.itens.some((i) => i.notaServicoId)) {
    throw new Error("Este orçamento já emitiu nota de serviço — não pode mais ser editado.");
  }

  const linhas = await montarLinhas(empresaId, input);
  if (!linhas.length) throw new Error(SEM_ITEM(input.tipoNota));
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
  // Orçamento de serviço pode ter emitido parte das notas sem estar fechado —
  // apagá-lo deixaria NFS-e emitida sem origem.
  const emitiu = await prisma.itemOrcamento.count({ where: { orcamentoId: id, notaServicoId: { not: null } } });
  if (emitiu) throw new Error("Este orçamento já emitiu nota de serviço — não pode ser excluído.");
  // Não exclui o que já virou nota (mantém o vínculo fiscal).
  await prisma.orcamento.deleteMany({ where: { id, emitenteId: empresaId, status: { not: "FECHADO" } } });
}

// Fecha o orçamento de serviço: emite uma NFS-e por item.
//
// Uma DPS descreve UM serviço, então três serviços no orçamento viram três
// notas. Cada linha guarda a nota que gerou: se a emissão parar no meio (fisco
// fora do ar, dado faltando), reexecutar continua de onde parou em vez de
// duplicar o que já saiu.
export type FecharServicoResultado =
  | { ok: true; emitidas: number; total: number; numeros: number[] }
  | { ok: false; erro: string; emitidas: number; total: number; numeros: number[] };

export async function converterEmNotasServico(id: string): Promise<FecharServicoResultado> {
  await exigirFeature("orcamentos");
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const vazio = { emitidas: 0, total: 0, numeros: [] as number[] };
  const o = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, include: { itens: true } });
  if (!o) return { ok: false, erro: "Orçamento não encontrado.", ...vazio };
  if (o.tipoNota !== TIPO_SERVICO) return { ok: false, erro: "Este orçamento não é de serviço.", ...vazio };
  if (o.status === "FECHADO") return { ok: false, erro: "Este orçamento já virou nota.", ...vazio };

  const itens = o.itens.filter((i) => i.servicoId || i.cTribNac);
  if (!itens.length) return { ok: false, erro: "Orçamento sem serviços válidos para emitir.", ...vazio };

  // O desconto geral é do orçamento inteiro; a NFS-e só tem um valor por nota.
  // Por isso ele é rateado entre os itens na proporção do subtotal de cada um.
  const somaItens = itens.reduce((s, i) => s + Number(i.valorTotal), 0);
  const fator = somaItens > 0 ? Number(o.valorTotal) / somaItens : 1;
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const numeros: number[] = [];
  let emitidas = 0;
  for (const i of itens) {
    if (i.notaServicoId) { emitidas++; continue; } // já saiu numa tentativa anterior
    const valor = Math.round(Number(i.valorTotal) * fator * 100) / 100;
    if (valor <= 0) continue;
    const r = await emitirParaEmpresa(empresaId, {
      clienteId: o.clienteId,
      servicoId: i.servicoId,
      descricao: i.descricao || i.nome,
      cTribNac: i.cTribNac ?? "",
      cNBS: i.cNBS ?? "",
      valorServico: valor,
      aliqISS: i.aliqISS == null ? 0 : Number(i.aliqISS),
      tribISSQN: "1",
      tpImunidade: "0",
      issRetido: false,
      codMunicipioPrestacao: "",
      competencia: hoje,
      informacoesAdicionais: o.observacoes ?? "",
    });
    if (!r.ok) {
      return { ok: false, erro: r.erro, emitidas, total: itens.length, numeros };
    }
    await prisma.itemOrcamento.update({ where: { id: i.id }, data: { notaServicoId: r.id } });
    numeros.push(r.numero);
    emitidas++;
  }

  await prisma.orcamento.update({ where: { id }, data: { status: "FECHADO" } });
  return { ok: true, emitidas, total: itens.length, numeros };
}

// Fecha a venda: emite a NF a partir do orçamento e marca como FECHADO.
// Reaproveita toda a emissão (emitirNota). Só fecha o orçamento se autorizar.
export async function converterEmNota(id: string): Promise<EmitirResultado> {
  await exigirFeature("orcamentos");
  const empresaId = await exigirEmpresa();
  const o = await prisma.orcamento.findFirst({ where: { id, emitenteId: empresaId }, include: { itens: true } });
  if (!o) return { ok: false, erro: "Orçamento não encontrado." };
  if (o.tipoNota === TIPO_SERVICO) return { ok: false, erro: "Orçamento de serviço fecha em NFS-e." };
  if (o.status === "FECHADO") return { ok: false, erro: "Este orçamento já virou nota." };

  const itens = o.itens
    .filter((i) => i.produtoId)
    .map((i) => ({
      produtoId: i.produtoId as string,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
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
