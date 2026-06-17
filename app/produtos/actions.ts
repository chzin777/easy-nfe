"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import type { Produto } from "@/lib/types";

type ProdutoRow = {
  id: string;
  codigoInterno: number;
  codigoBarras: string | null;
  nome: string;
  unidade: string;
  ncm: string;
  origem: string;
  preco: unknown;
  descricao: string | null;
  cest: string | null;
  codigoBeneficio: string | null;
  creditoPresumidoIcms: string | null;
  reguladoAnp: boolean;
};

function paraUI(p: ProdutoRow): Produto {
  return {
    id: p.id,
    codigoInterno: p.codigoInterno,
    codigoBarras: p.codigoBarras ?? "",
    nome: p.nome,
    unidade: p.unidade,
    ncm: p.ncm,
    origem: p.origem,
    preco: Number(p.preco),
    descricao: p.descricao ?? "",
    cest: p.cest ?? "",
    codigoBeneficio: p.codigoBeneficio ?? "",
    creditoPresumidoIcms: p.creditoPresumidoIcms ?? "",
    reguladoAnp: p.reguladoAnp,
  };
}

export type ProdutoInput = Omit<Produto, "id" | "codigoInterno">;

export async function listarProdutos(): Promise<Produto[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.produto.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
  });
  return rows.map(paraUI);
}

export async function criarProduto(input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  const p = await prisma.produto.create({
    data: {
      empresaId,
      codigoBarras: input.codigoBarras || null,
      nome: input.nome,
      unidade: input.unidade,
      ncm: input.ncm,
      origem: input.origem,
      preco: input.preco,
      descricao: input.descricao || null,
      cest: input.cest || null,
      codigoBeneficio: input.codigoBeneficio || null,
      creditoPresumidoIcms: input.creditoPresumidoIcms || null,
      reguladoAnp: input.reguladoAnp,
    },
  });
  return paraUI(p);
}

export async function atualizarProduto(id: string, input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  // updateMany garante escopo por empresa (não atualiza produto de outra empresa).
  await prisma.produto.updateMany({
    where: { id, empresaId },
    data: {
      codigoBarras: input.codigoBarras || null,
      nome: input.nome,
      unidade: input.unidade,
      ncm: input.ncm,
      origem: input.origem,
      preco: input.preco,
      descricao: input.descricao || null,
      cest: input.cest || null,
      codigoBeneficio: input.codigoBeneficio || null,
      creditoPresumidoIcms: input.creditoPresumidoIcms || null,
      reguladoAnp: input.reguladoAnp,
    },
  });
  const p = await prisma.produto.findFirstOrThrow({ where: { id, empresaId } });
  return paraUI(p);
}

export async function excluirProduto(id: string): Promise<void> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  await prisma.produto.deleteMany({ where: { id, empresaId } });
}
