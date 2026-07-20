"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import type { Cliente } from "@/lib/types";
import type { ClienteImport } from "@/lib/clientes-modelo";

type Row = {
  id: string;
  codigoInterno: number;
  padrao: boolean;
  tipoContribuinte: string;
  documento: string;
  nome: string;
  inscricaoEstadual: string | null;
  categoriaId: string | null;
  categoria?: { nome: string } | null;
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
    padrao: c.padrao,
    tipoContribuinte: c.tipoContribuinte,
    documento: c.documento,
    nome: c.nome,
    inscricaoEstadual: c.inscricaoEstadual ?? "",
    categoriaId: c.categoriaId ?? "",
    categoriaNome: c.categoria?.nome ?? "",
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

export type ClienteInput = Omit<Cliente, "id" | "codigoInterno" | "categoriaNome" | "padrao">;

// Garante o cliente "Consumidor final" (padrão) da empresa. Idempotente — usado
// como seed lazy: toda empresa passa a ter esse cliente ao listar/usar clientes.
// Consumidor não identificado: sem documento, não contribuinte (indIEDest=9).
export async function garantirConsumidorFinal(empresaId: string): Promise<void> {
  const existe = await prisma.cliente.findFirst({ where: { empresaId, padrao: true }, select: { id: true } });
  if (existe) return;
  await prisma.cliente.create({
    data: { empresaId, padrao: true, nome: "Consumidor final", tipoContribuinte: "9", documento: "" },
  });
}

function paraDados(input: ClienteInput) {
  return {
    tipoContribuinte: input.tipoContribuinte,
    documento: input.documento,
    nome: input.nome,
    inscricaoEstadual: input.inscricaoEstadual || null,
    categoriaId: input.categoriaId || null,
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
  await garantirConsumidorFinal(empresaId); // seed lazy p/ empresas já existentes
  const rows = await prisma.cliente.findMany({
    where: { empresaId },
    // Consumidor final sempre no topo da lista.
    orderBy: [{ padrao: "desc" }, { codigoInterno: "asc" }],
    include: { categoria: { select: { nome: true } } },
  });
  return rows.map(paraUI);
}

export async function criarCliente(input: ClienteInput): Promise<Cliente> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  const c = await prisma.cliente.create({
    data: { empresaId, ...paraDados(input) },
    include: { categoria: { select: { nome: true } } },
  });
  return paraUI(c);
}

export async function atualizarCliente(id: string, input: ClienteInput): Promise<void> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  await prisma.cliente.updateMany({ where: { id, empresaId }, data: paraDados(input) });
}

// Importação em massa (CSV/XLSX). Revalida no servidor e cria em lote.
export async function importarClientes(
  itens: ClienteImport[],
): Promise<{ criados: number; ignorados: number; erros: string[] }> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();

  const erros: string[] = [];
  const validos: ClienteImport[] = [];
  itens.forEach((it, idx) => {
    const nome = (it.nome ?? "").trim();
    const documento = (it.documento ?? "").replace(/\D/g, "");
    if (!nome) erros.push(`Linha ${idx + 1}: nome obrigatório.`);
    else if (!documento) erros.push(`Linha ${idx + 1}: CPF/CNPJ obrigatório.`);
    else validos.push({ ...it, nome, documento });
  });

  if (validos.length) {
    await prisma.cliente.createMany({
      data: validos.map((i) => ({
        empresaId,
        tipoContribuinte: i.tipoContribuinte || (i.documento.length === 14 ? "1" : "9"),
        documento: i.documento,
        nome: i.nome,
        inscricaoEstadual: i.inscricaoEstadual || null,
        telefone: i.telefone || null,
        email: i.email || null,
        cep: i.cep || null,
        logradouro: i.logradouro || null,
        numero: i.numero || null,
        complemento: i.complemento || null,
        bairro: i.bairro || null,
        municipio: i.municipio || null,
        uf: i.uf || null,
      })),
    });
  }

  return { criados: validos.length, ignorados: itens.length - validos.length, erros };
}

export async function excluirCliente(id: string): Promise<void> {
  await exigirFeature("clientes");
  const empresaId = await exigirEmpresa();
  // Não exclui o Consumidor final (cliente padrão do sistema).
  await prisma.cliente.deleteMany({ where: { id, empresaId, padrao: false } });
}

// ---------------------------------------------------------------------------
// Ações em massa (seleção múltipla na lista). Todo where cruza `ids` com
// `empresaId` — uma empresa nunca alcança linha de outra.
// ---------------------------------------------------------------------------
export type ResultadoMassa = { ok: true; afetados: number } | { ok: false; erro: string };

export async function excluirClientes(ids: string[]): Promise<ResultadoMassa> {
  try {
    await exigirFeature("clientes");
    const empresaId = await exigirEmpresa();
    if (!ids.length) return { ok: false, erro: "Nenhum cliente selecionado." };
    // padrao: false mantém o Consumidor final fora de qualquer exclusão.
    const r = await prisma.cliente.deleteMany({ where: { id: { in: ids }, empresaId, padrao: false } });
    return { ok: true, afetados: r.count };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Só os campos marcados no modal chegam aqui — `undefined` = não alterar.
export type PatchClientes = {
  categoriaId?: string; // "" remove a categoria
  tipoContribuinte?: string;
  municipio?: string;
  uf?: string;
};

export async function atualizarClientesEmMassa(
  ids: string[],
  patch: PatchClientes,
): Promise<ResultadoMassa> {
  try {
    await exigirFeature("clientes");
    const empresaId = await exigirEmpresa();
    if (!ids.length) return { ok: false, erro: "Nenhum cliente selecionado." };

    // Unchecked: `categoriaId` é campo escalar de relação (não entra no input "checked").
    const data: Prisma.ClienteUncheckedUpdateManyInput = {};
    if (patch.categoriaId !== undefined) data.categoriaId = patch.categoriaId || null;
    if (patch.tipoContribuinte !== undefined) data.tipoContribuinte = patch.tipoContribuinte;
    if (patch.municipio !== undefined) data.municipio = patch.municipio.trim() || null;
    if (patch.uf !== undefined) data.uf = patch.uf || null;

    if (Object.keys(data).length === 0) return { ok: false, erro: "Nenhum campo selecionado para alterar." };

    // O Consumidor final é fixo do sistema: não entra na edição em massa.
    const r = await prisma.cliente.updateMany({
      where: { id: { in: ids }, empresaId, padrao: false },
      data,
    });
    return { ok: true, afetados: r.count };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
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
