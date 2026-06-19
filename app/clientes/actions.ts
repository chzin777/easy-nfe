"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
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
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  const c = await prisma.cliente.create({ data: { empresaId, ...paraDados(input) } });
  return paraUI(c);
}

export async function atualizarCliente(id: string, input: ClienteInput): Promise<void> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  await prisma.cliente.updateMany({ where: { id, empresaId }, data: paraDados(input) });
}

export async function excluirCliente(id: string): Promise<void> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  await prisma.cliente.deleteMany({ where: { id, empresaId } });
}

export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  endereco: { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string };
};

// Consulta dados públicos do CNPJ na BrasilAPI (grátis, sem chave).
export async function buscarCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return null;
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return null;
    const j = (await resp.json()) as Record<string, unknown>;
    const s = (k: string) => (typeof j[k] === "string" ? (j[k] as string) : "");
    const n = (k: string) => (j[k] == null ? "" : String(j[k]));
    return {
      razaoSocial: s("razao_social"),
      nomeFantasia: s("nome_fantasia"),
      telefone: n("ddd_telefone_1"),
      email: s("email"),
      endereco: {
        cep: n("cep"),
        logradouro: s("logradouro"),
        numero: n("numero"),
        complemento: s("complemento"),
        bairro: s("bairro"),
        municipio: s("municipio"),
        uf: s("uf"),
      },
    };
  } catch {
    return null;
  }
}
