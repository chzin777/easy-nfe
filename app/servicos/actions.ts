"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";

// Catálogo de serviços — o equivalente ao de produtos para a NFS-e.
//
// A classificação fiscal aqui é outra: em vez de NCM/CST, o que identifica o
// serviço é o código de tributação nacional (6 dígitos, derivado da lista da
// LC 116/2003). O ISS é municipal, então a alíquota vem do município do
// prestador — por isso fica no serviço, não numa tabela fixa.

export type Servico = {
  id: string;
  codigoInterno: number;
  nome: string;
  descricao: string;
  cTribNac: string;
  itemListaServico: string;
  cNBS: string;
  aliqISS: number;
  valorUnit: number;
};

export type ServicoInput = Omit<Servico, "id" | "codigoInterno">;

type Row = {
  id: string; codigoInterno: number; nome: string; descricao: string | null;
  cTribNac: string; itemListaServico: string | null; cNBS: string | null;
  aliqISS: unknown; valorUnit: unknown;
};

function paraUI(s: Row): Servico {
  return {
    id: s.id,
    codigoInterno: s.codigoInterno,
    nome: s.nome,
    descricao: s.descricao ?? "",
    cTribNac: s.cTribNac,
    itemListaServico: s.itemListaServico ?? "",
    cNBS: s.cNBS ?? "",
    aliqISS: s.aliqISS == null ? 0 : Number(s.aliqISS),
    valorUnit: Number(s.valorUnit),
  };
}

const so = (v: string) => (v ?? "").replace(/\D/g, "");

function paraDados(input: ServicoInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao.trim() || null,
    cTribNac: so(input.cTribNac),
    itemListaServico: input.itemListaServico.trim() || null,
    cNBS: so(input.cNBS) || null,
    aliqISS: input.aliqISS > 0 ? input.aliqISS : null,
    valorUnit: input.valorUnit,
  };
}

// O código de tributação nacional tem 6 dígitos e é o que o fisco usa para
// saber qual serviço foi prestado — sem ele a DPS é rejeitada.
function validar(input: ServicoInput): string | null {
  if (!input.nome.trim()) return "Informe o nome do serviço.";
  if (so(input.cTribNac).length !== 6) return "O código de tributação nacional tem 6 dígitos.";
  if (input.cNBS && so(input.cNBS).length !== 9) return "O código NBS tem 9 dígitos.";
  if (input.valorUnit < 0) return "Valor não pode ser negativo.";
  if (input.aliqISS < 0 || input.aliqISS > 100) return "Alíquota do ISS fora da faixa.";
  return null;
}

export async function listarServicos(): Promise<Servico[]> {
  const empresaId = await exigirEmpresa();
  const linhas = await prisma.servico.findMany({
    where: { empresaId },
    orderBy: { nome: "asc" },
  });
  return linhas.map(paraUI);
}

export async function criarServico(input: ServicoInput): Promise<Servico> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const erro = validar(input);
  if (erro) throw new Error(erro);
  const s = await prisma.servico.create({ data: { empresaId, ...paraDados(input) } });
  return paraUI(s);
}

export async function atualizarServico(id: string, input: ServicoInput): Promise<Servico> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const erro = validar(input);
  if (erro) throw new Error(erro);
  const existe = await prisma.servico.findFirst({ where: { id, empresaId }, select: { id: true } });
  if (!existe) throw new Error("Serviço não encontrado.");
  const s = await prisma.servico.update({ where: { id }, data: paraDados(input) });
  return paraUI(s);
}

export async function excluirServico(id: string): Promise<void> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const existe = await prisma.servico.findFirst({ where: { id, empresaId }, select: { id: true } });
  if (!existe) throw new Error("Serviço não encontrado.");
  // Nota emitida guarda o serviço como referência; apagar o catálogo não pode
  // levar a nota junto, então a relação é desfeita em vez de bloquear.
  await prisma.notaServico.updateMany({ where: { servicoId: id }, data: { servicoId: null } });
  await prisma.servico.delete({ where: { id } });
}
