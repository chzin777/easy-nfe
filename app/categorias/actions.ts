"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";

// Categorias de "produto" ou "cliente", escopadas à empresa ativa.
export type TipoCategoria = "produto" | "cliente";

export type Categoria = {
  id: string;
  tipo: TipoCategoria;
  nome: string;
  cor: string | null;
};

function paraUI(c: { id: string; tipo: string; nome: string; cor: string | null }): Categoria {
  return { id: c.id, tipo: c.tipo as TipoCategoria, nome: c.nome, cor: c.cor };
}

export async function listarCategorias(tipo: TipoCategoria): Promise<Categoria[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.categoria.findMany({
    where: { empresaId, tipo },
    orderBy: { nome: "asc" },
  });
  return rows.map(paraUI);
}

export async function criarCategoria(
  tipo: TipoCategoria,
  nome: string,
  cor?: string | null,
): Promise<Categoria> {
  const empresaId = await exigirEmpresa();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Nome da categoria é obrigatório.");
  const c = await prisma.categoria.create({
    data: { empresaId, tipo, nome: limpo, cor: cor || null },
  });
  return paraUI(c);
}

export async function atualizarCategoria(
  id: string,
  nome: string,
  cor?: string | null,
): Promise<void> {
  const empresaId = await exigirEmpresa();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Nome da categoria é obrigatório.");
  await prisma.categoria.updateMany({
    where: { id, empresaId },
    data: { nome: limpo, cor: cor || null },
  });
}

// Exclui a categoria. Produtos/clientes vinculados ficam sem categoria (SetNull).
export async function excluirCategoria(id: string): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.categoria.deleteMany({ where: { id, empresaId } });
}
