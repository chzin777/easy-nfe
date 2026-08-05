"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import {
  hojeBrasilia,
  isoBrasilia,
  primeiraEmissao,
  processarContratosVencidos,
} from "@/lib/contratos";

// Contratos recorrentes de NFS-e: cadastra uma vez, o robô emite todo mês.
// A recorrência não é fiscal — o que vale é cada nota gerada.

export type Periodicidade = "MENSAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";

export type Contrato = {
  id: string;
  nome: string;
  clienteId: string;
  clienteNome: string;
  servicoId: string | null;
  descricaoServico: string;
  cTribNac: string;
  itemListaServico: string;
  cNBS: string;
  codMunicipioPrestacao: string;
  valorServico: number;
  aliqISS: number;
  tribISSQN: string;
  tpImunidade: string;
  issRetido: boolean;
  informacoesAdicionais: string;
  periodicidade: Periodicidade;
  diaEmissao: number;
  proximaEmissao: string; // yyyy-mm-dd
  fim: string; // yyyy-mm-dd ou ""
  ativo: boolean;
  ultimaEmissaoEm: string | null;
  ultimoErro: string | null;
  notasGeradas: number;
};

export type ContratoInput = Omit<
  Contrato,
  "id" | "clienteNome" | "proximaEmissao" | "ultimaEmissaoEm" | "ultimoErro" | "notasGeradas"
> & {
  // Vazio = calculada a partir do dia e da periodicidade.
  proximaEmissao?: string;
};

const COM_CLIENTE = { cliente: { select: { nome: true } } } as const;

type Row = Awaited<
  ReturnType<typeof prisma.contratoServico.findFirstOrThrow<{ include: typeof COM_CLIENTE }>>
>;

function paraUI(c: Row): Contrato {
  return {
    id: c.id,
    nome: c.nome,
    clienteId: c.clienteId,
    clienteNome: c.cliente.nome,
    servicoId: c.servicoId,
    descricaoServico: c.descricaoServico,
    cTribNac: c.cTribNac,
    itemListaServico: c.itemListaServico ?? "",
    cNBS: c.cNBS ?? "",
    codMunicipioPrestacao: c.codMunicipioPrestacao,
    valorServico: Number(c.valorServico),
    aliqISS: c.aliqISS == null ? 0 : Number(c.aliqISS),
    tribISSQN: c.tribISSQN,
    tpImunidade: c.tpImunidade,
    issRetido: c.issRetido,
    informacoesAdicionais: c.informacoesAdicionais ?? "",
    periodicidade: c.periodicidade as Periodicidade,
    diaEmissao: c.diaEmissao,
    proximaEmissao: isoBrasilia(c.proximaEmissao),
    fim: c.fim ? isoBrasilia(c.fim) : "",
    ativo: c.ativo,
    ultimaEmissaoEm: c.ultimaEmissaoEm ? c.ultimaEmissaoEm.toISOString() : null,
    ultimoErro: c.ultimoErro,
    notasGeradas: c.notasGeradas,
  };
}

const so = (v: string) => (v ?? "").replace(/\D/g, "");

// Data "yyyy-mm-dd" vinda do formulário vira meia-noite de Brasília.
function dataDoForm(iso: string): Date {
  return new Date(`${iso}T00:00:00-03:00`);
}

function validar(input: ContratoInput): string | null {
  if (!input.nome.trim()) return "Dê um nome ao contrato.";
  if (!input.clienteId) return "Escolha o tomador.";
  if (!input.descricaoServico.trim()) return "Descreva o serviço.";
  if (so(input.cTribNac).length !== 6) return "O código de tributação nacional tem 6 dígitos.";
  if (input.valorServico <= 0) return "Valor do serviço deve ser maior que zero.";
  if (input.diaEmissao < 1 || input.diaEmissao > 31) return "Dia de emissão entre 1 e 31.";
  if (input.aliqISS < 0 || input.aliqISS > 100) return "Alíquota do ISS fora da faixa.";
  return null;
}

function paraDados(input: ContratoInput) {
  return {
    nome: input.nome.trim(),
    clienteId: input.clienteId,
    servicoId: input.servicoId || null,
    descricaoServico: input.descricaoServico.trim(),
    cTribNac: so(input.cTribNac),
    itemListaServico: input.itemListaServico.trim() || null,
    cNBS: so(input.cNBS) || null,
    codMunicipioPrestacao: so(input.codMunicipioPrestacao),
    valorServico: input.valorServico,
    aliqISS: input.tribISSQN === "1" && input.aliqISS > 0 ? input.aliqISS : null,
    tribISSQN: input.tribISSQN,
    tpImunidade: input.tpImunidade,
    issRetido: input.issRetido,
    informacoesAdicionais: input.informacoesAdicionais.trim() || null,
    periodicidade: input.periodicidade,
    diaEmissao: input.diaEmissao,
    fim: input.fim ? dataDoForm(input.fim) : null,
    ativo: input.ativo,
  };
}

export async function listarContratos(): Promise<Contrato[]> {
  const empresaId = await exigirEmpresa();
  const linhas = await prisma.contratoServico.findMany({
    where: { emitenteId: empresaId },
    orderBy: [{ ativo: "desc" }, { proximaEmissao: "asc" }],
    include: COM_CLIENTE,
  });
  return linhas.map(paraUI);
}

export async function criarContrato(input: ContratoInput): Promise<Contrato> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const erro = validar(input);
  if (erro) throw new Error(erro);

  const cliente = await prisma.cliente.findFirst({
    where: { id: input.clienteId, empresaId },
    select: { id: true },
  });
  if (!cliente) throw new Error("Cliente não encontrado.");

  const c = await prisma.contratoServico.create({
    data: {
      emitenteId: empresaId,
      ...paraDados(input),
      proximaEmissao: input.proximaEmissao
        ? dataDoForm(input.proximaEmissao)
        : primeiraEmissao(input.periodicidade, input.diaEmissao),
    },
    include: COM_CLIENTE,
  });
  return paraUI(c);
}

export async function atualizarContrato(id: string, input: ContratoInput): Promise<Contrato> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const erro = validar(input);
  if (erro) throw new Error(erro);

  const atual = await prisma.contratoServico.findFirst({ where: { id, emitenteId: empresaId } });
  if (!atual) throw new Error("Contrato não encontrado.");

  // Mudou o dia ou a periodicidade: recalcula a próxima data, senão mantém a
  // que já estava agendada.
  const mudouRegua =
    atual.diaEmissao !== input.diaEmissao || atual.periodicidade !== input.periodicidade;
  const proximaEmissao = input.proximaEmissao
    ? dataDoForm(input.proximaEmissao)
    : mudouRegua
      ? primeiraEmissao(input.periodicidade, input.diaEmissao)
      : atual.proximaEmissao;

  const c = await prisma.contratoServico.update({
    where: { id },
    data: { ...paraDados(input), proximaEmissao, ...(input.ativo ? { falhas: 0, ultimoErro: null } : {}) },
    include: COM_CLIENTE,
  });
  return paraUI(c);
}

export async function alternarContrato(id: string, ativo: boolean): Promise<Contrato> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const atual = await prisma.contratoServico.findFirst({ where: { id, emitenteId: empresaId } });
  if (!atual) throw new Error("Contrato não encontrado.");

  // Religar um contrato que ficou parado no passado não pode disparar várias
  // notas atrasadas de uma vez: a próxima data volta para o futuro.
  const proximaEmissao =
    ativo && atual.proximaEmissao < hojeBrasilia()
      ? primeiraEmissao(atual.periodicidade, atual.diaEmissao)
      : atual.proximaEmissao;

  const c = await prisma.contratoServico.update({
    where: { id },
    data: { ativo, proximaEmissao, ...(ativo ? { falhas: 0, ultimoErro: null } : {}) },
    include: COM_CLIENTE,
  });
  return paraUI(c);
}

export async function excluirContrato(id: string): Promise<void> {
  await exigirFeature("emitir_nfse");
  const empresaId = await exigirEmpresa();
  const existe = await prisma.contratoServico.findFirst({
    where: { id, emitenteId: empresaId },
    select: { id: true },
  });
  if (!existe) throw new Error("Contrato não encontrado.");
  // As notas já emitidas continuam de pé, só perdem o vínculo.
  await prisma.notaServico.updateMany({ where: { contratoId: id }, data: { contratoId: null } });
  await prisma.contratoServico.delete({ where: { id } });
}

// Emite a nota do contrato agora, sem esperar a data. A régua avança um
// período — não gera nota dobrada no dia certo.
export async function emitirContratoAgora(
  id: string,
): Promise<{ ok: true; numero?: number } | { ok: false; erro: string }> {
  try {
    await exigirFeature("emitir_nfse");
    const empresaId = await exigirEmpresa();
    const contrato = await prisma.contratoServico.findFirst({
      where: { id, emitenteId: empresaId },
      select: { id: true, ativo: true },
    });
    if (!contrato) return { ok: false, erro: "Contrato não encontrado." };
    if (!contrato.ativo) return { ok: false, erro: "Contrato pausado. Reative antes de emitir." };

    const r = await processarContratosVencidos({ empresaId, contratoId: id, forcar: true });
    const d = r.detalhes[0];
    if (!d) return { ok: false, erro: "Nada a emitir para este contrato." };
    return d.ok ? { ok: true, numero: d.numero } : { ok: false, erro: d.erro ?? "Falha na emissão." };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
