"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import type { Endereco } from "@/lib/types";

export type Fornecedor = {
  id: string;
  codigoInterno: number;
  documento: string; // CNPJ ou CPF
  nome: string; // razão social
  nomeFantasia: string;
  inscricaoEstadual: string;
  observacoes: string;
  contato: { telefone: string; email: string };
  endereco: Endereco;
};

export type FornecedorInput = Omit<Fornecedor, "id" | "codigoInterno">;

type Row = {
  id: string;
  codigoInterno: number;
  documento: string;
  nome: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  observacoes: string | null;
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

function paraUI(f: Row): Fornecedor {
  return {
    id: f.id,
    codigoInterno: f.codigoInterno,
    documento: f.documento,
    nome: f.nome,
    nomeFantasia: f.nomeFantasia ?? "",
    inscricaoEstadual: f.inscricaoEstadual ?? "",
    observacoes: f.observacoes ?? "",
    contato: { telefone: f.telefone ?? "", email: f.email ?? "" },
    endereco: {
      cep: f.cep ?? "", logradouro: f.logradouro ?? "", numero: f.numero ?? "",
      complemento: f.complemento ?? "", bairro: f.bairro ?? "",
      municipio: f.municipio ?? "", uf: f.uf ?? "",
    },
  };
}

function paraDados(input: FornecedorInput) {
  return {
    documento: input.documento.replace(/\D/g, ""),
    nome: input.nome,
    nomeFantasia: input.nomeFantasia || null,
    inscricaoEstadual: input.inscricaoEstadual || null,
    observacoes: input.observacoes || null,
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

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.fornecedor.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
  });
  return rows.map(paraUI);
}

export async function criarFornecedor(input: FornecedorInput): Promise<Fornecedor> {
  const empresaId = await exigirEmpresa();
  if (!input.documento.replace(/\D/g, "")) throw new Error("CNPJ/CPF é obrigatório.");
  if (!input.nome.trim()) throw new Error("Razão social é obrigatória.");
  const f = await prisma.fornecedor.create({ data: { empresaId, ...paraDados(input) } });
  return paraUI(f);
}

export async function atualizarFornecedor(id: string, input: FornecedorInput): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.fornecedor.updateMany({ where: { id, empresaId }, data: paraDados(input) });
}

export async function excluirFornecedor(id: string): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.fornecedor.deleteMany({ where: { id, empresaId } });
}

// Identifica fornecedores cadastrados a partir de uma lista de CNPJs (emitentes
// das notas recebidas). Retorna mapa CNPJ(só dígitos) → nome do fornecedor.
export async function identificarFornecedores(cnpjs: string[]): Promise<Record<string, string>> {
  const empresaId = await exigirEmpresa();
  const docs = [...new Set(cnpjs.map((c) => (c || "").replace(/\D/g, "")).filter(Boolean))];
  if (docs.length === 0) return {};
  const rows = await prisma.fornecedor.findMany({
    where: { empresaId, documento: { in: docs } },
    select: { documento: true, nome: true },
  });
  return Object.fromEntries(rows.map((r) => [r.documento, r.nome]));
}
