"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import type { Transportadora } from "@/lib/types";

type Row = {
  id: string;
  codigoInterno: number;
  tipoTransporte: string;
  documento: string;
  nome: string;
  inscricaoEstadual: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
};

function paraUI(t: Row): Transportadora {
  return {
    id: t.id,
    codigoInterno: t.codigoInterno,
    tipoTransporte: t.tipoTransporte,
    documento: t.documento,
    nome: t.nome,
    inscricaoEstadual: t.inscricaoEstadual ?? "",
    contato: { telefone: t.telefone ?? "", email: t.email ?? "" },
    endereco: {
      cep: t.cep ?? "",
      logradouro: t.logradouro ?? "",
      numero: t.numero ?? "",
      complemento: t.complemento ?? "",
      bairro: t.bairro ?? "",
      municipio: t.municipio ?? "",
      uf: t.uf ?? "",
    },
  };
}

export type TransportadoraInput = Omit<Transportadora, "id" | "codigoInterno">;

function paraDados(input: TransportadoraInput) {
  return {
    tipoTransporte: input.tipoTransporte,
    documento: input.documento,
    nome: input.nome,
    inscricaoEstadual: input.inscricaoEstadual || null,
    telefone: input.contato.telefone || null,
    email: input.contato.email || null,
    cep: input.endereco.cep || null,
    logradouro: input.endereco.logradouro || null,
    numero: input.endereco.numero || null,
    complemento: input.endereco.complemento || null,
    bairro: input.endereco.bairro || null,
    municipio: input.endereco.municipio || null,
    uf: input.endereco.uf || null,
  };
}

export async function listarTransportadoras(): Promise<Transportadora[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.transportadora.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
  });
  return rows.map(paraUI);
}

export async function criarTransportadora(
  input: TransportadoraInput,
): Promise<Transportadora> {
  await exigirFeature("transportadoras");
  const empresaId = await exigirEmpresa();
  const t = await prisma.transportadora.create({ data: { empresaId, ...paraDados(input) } });
  return paraUI(t);
}

export async function atualizarTransportadora(
  id: string,
  input: TransportadoraInput,
): Promise<void> {
  await exigirFeature("transportadoras");
  const empresaId = await exigirEmpresa();
  await prisma.transportadora.updateMany({ where: { id, empresaId }, data: paraDados(input) });
}

export async function excluirTransportadora(id: string): Promise<void> {
  await exigirFeature("transportadoras");
  const empresaId = await exigirEmpresa();
  await prisma.transportadora.deleteMany({ where: { id, empresaId } });
}
