"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import type { Cliente } from "@/lib/types";

type Row = {
  id: string;
  codigoInterno: number;
  tipoContribuinte: string;
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

function paraUI(c: Row): Cliente {
  return {
    id: c.id,
    codigoInterno: c.codigoInterno,
    tipoContribuinte: c.tipoContribuinte,
    documento: c.documento,
    nome: c.nome,
    inscricaoEstadual: c.inscricaoEstadual ?? "",
    contato: { telefone: c.telefone ?? "", email: c.email ?? "" },
    endereco: {
      cep: c.cep ?? "",
      logradouro: c.logradouro ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      bairro: c.bairro ?? "",
      municipio: c.municipio ?? "",
      uf: c.uf ?? "",
    },
  };
}

export type ClienteInput = Omit<Cliente, "id" | "codigoInterno">;

function paraDados(input: ClienteInput) {
  return {
    tipoContribuinte: input.tipoContribuinte,
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

export async function listarClientes(): Promise<Cliente[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.cliente.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
  });
  return rows.map(paraUI);
}

export async function criarCliente(input: ClienteInput): Promise<Cliente> {
  const empresaId = await exigirEmpresa();
  const c = await prisma.cliente.create({ data: { empresaId, ...paraDados(input) } });
  return paraUI(c);
}

export async function atualizarCliente(id: string, input: ClienteInput): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.cliente.updateMany({ where: { id, empresaId }, data: paraDados(input) });
}

export async function excluirCliente(id: string): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.cliente.deleteMany({ where: { id, empresaId } });
}
