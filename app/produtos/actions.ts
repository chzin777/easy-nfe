"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import type { Produto } from "@/lib/types";
import type { ProdutoImport } from "@/lib/produtos-modelo";

type ProdutoRow = {
  id: string;
  codigoInterno: number;
  codigoBarras: string | null;
  nome: string;
  marca: string | null;
  peso: unknown;
  unidade: string;
  ncm: string;
  origem: string;
  preco: unknown;
  descricao: string | null;
  categoriaId: string | null;
  categoria?: { nome: string } | null;
  cst: string | null;
  aliquotaIcms: unknown;
  reducaoBaseIcms: unknown;
  cest: string | null;
  codigoBeneficio: string | null;
  creditoPresumidoIcms: string | null;
  reguladoAnp: boolean;
  estoque: unknown;
  controlaEstoque: boolean;
};

function paraUI(p: ProdutoRow): Produto {
  return {
    id: p.id,
    codigoInterno: p.codigoInterno,
    codigoBarras: p.codigoBarras ?? "",
    nome: p.nome,
    marca: p.marca ?? "",
    peso: p.peso == null ? 0 : Number(p.peso),
    unidade: p.unidade,
    ncm: p.ncm,
    origem: p.origem,
    preco: Number(p.preco),
    descricao: p.descricao ?? "",
    categoriaId: p.categoriaId ?? "",
    categoriaNome: p.categoria?.nome ?? "",
    cst: p.cst ?? "40",
    aliquotaIcms: p.aliquotaIcms == null ? 0 : Number(p.aliquotaIcms),
    reducaoBaseIcms: p.reducaoBaseIcms == null ? 0 : Number(p.reducaoBaseIcms),
    cest: p.cest ?? "",
    codigoBeneficio: p.codigoBeneficio ?? "",
    creditoPresumidoIcms: p.creditoPresumidoIcms ?? "",
    reguladoAnp: p.reguladoAnp,
    estoque: p.estoque == null ? 0 : Number(p.estoque),
    controlaEstoque: p.controlaEstoque,
  };
}

export type ProdutoInput = Omit<Produto, "id" | "codigoInterno" | "categoriaNome">;

// Campos persistidos (sem os derivados). peso 0 / categoria "" viram null.
function paraDados(input: ProdutoInput) {
  return {
    codigoBarras: input.codigoBarras || null,
    nome: input.nome,
    marca: input.marca || null,
    peso: input.peso > 0 ? input.peso : null,
    unidade: input.unidade,
    ncm: input.ncm,
    origem: input.origem,
    preco: input.preco,
    descricao: input.descricao || null,
    categoriaId: input.categoriaId || null,
    cst: input.cst || "40",
    aliquotaIcms: input.cst === "20" && input.aliquotaIcms > 0 ? input.aliquotaIcms : null,
    reducaoBaseIcms: input.cst === "20" && input.reducaoBaseIcms > 0 ? input.reducaoBaseIcms : null,
    cest: input.cest || null,
    codigoBeneficio: input.codigoBeneficio || null,
    creditoPresumidoIcms: input.creditoPresumidoIcms || null,
    reguladoAnp: input.reguladoAnp,
    controlaEstoque: input.controlaEstoque,
  };
}

export async function listarProdutos(): Promise<Produto[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.produto.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
    include: { categoria: { select: { nome: true } } },
  });
  return rows.map(paraUI);
}

export async function criarProduto(input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  // estoque inicial só na criação (depois muda via emissão/ajuste, nunca pelo form).
  const estoqueInicial = input.controlaEstoque && input.estoque > 0 ? input.estoque : 0;
  const p = await prisma.produto.create({
    data: { empresaId, ...paraDados(input), estoque: estoqueInicial },
    include: { categoria: { select: { nome: true } } },
  });
  if (estoqueInicial > 0) {
    await prisma.movimentoEstoque.create({
      data: {
        empresaId, produtoId: p.id, tipo: "ENTRADA",
        quantidade: estoqueInicial, saldoApos: estoqueInicial, motivo: "Estoque inicial",
      },
    });
  }
  return paraUI(p);
}

export async function atualizarProduto(id: string, input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  // updateMany garante escopo por empresa (não atualiza produto de outra empresa).
  await prisma.produto.updateMany({
    where: { id, empresaId },
    data: paraDados(input),
  });
  const p = await prisma.produto.findFirstOrThrow({
    where: { id, empresaId },
    include: { categoria: { select: { nome: true } } },
  });
  return paraUI(p);
}

// Importação em massa (CSV/XLSX). Recebe linhas já mapeadas por chave; revalida
// no servidor e cria em lote. Ignora linhas com erro (nome/NCM faltando).
export async function importarProdutos(
  itens: ProdutoImport[],
): Promise<{ criados: number; ignorados: number; erros: string[] }> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();

  // Guard final: exige nome e NCM (já validados no cliente, revalidados aqui).
  const erros: string[] = [];
  const validos: ProdutoImport[] = [];
  itens.forEach((it, idx) => {
    const nome = (it.nome ?? "").trim();
    const ncm = (it.ncm ?? "").replace(/\D/g, "");
    if (!nome) erros.push(`Linha ${idx + 1}: nome obrigatório.`);
    else if (!ncm) erros.push(`Linha ${idx + 1}: NCM obrigatório.`);
    else validos.push({ ...it, nome, ncm, preco: Number(it.preco) || 0 });
  });

  if (validos.length) {
    await prisma.produto.createMany({
      data: validos.map((i) => ({
        empresaId,
        codigoBarras: i.codigoBarras || null,
        nome: i.nome,
        unidade: i.unidade,
        ncm: i.ncm,
        origem: i.origem,
        preco: i.preco,
        descricao: i.descricao || null,
        cest: i.cest || null,
        codigoBeneficio: i.codigoBeneficio || null,
        creditoPresumidoIcms: i.creditoPresumidoIcms || null,
        reguladoAnp: i.reguladoAnp,
      })),
    });
  }

  return { criados: validos.length, ignorados: itens.length - validos.length, erros };
}

export async function excluirProduto(id: string): Promise<void> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  await prisma.produto.deleteMany({ where: { id, empresaId } });
}

// Ajuste manual de estoque. `novoSaldo` = saldo final desejado; registra o
// movimento (ENTRADA/SAIDA/AJUSTE conforme o delta) e atualiza o produto.
export async function ajustarEstoque(
  produtoId: string,
  novoSaldo: number,
  motivo?: string,
): Promise<{ ok: true; estoque: number } | { ok: false; erro: string }> {
  try {
    await exigirFeature("produtos");
    const empresaId = await exigirEmpresa();
    if (!Number.isFinite(novoSaldo)) return { ok: false, erro: "Saldo inválido." };
    const saldo = Math.round(novoSaldo * 1e4) / 1e4; // 4 casas

    const prod = await prisma.produto.findFirst({ where: { id: produtoId, empresaId } });
    if (!prod) return { ok: false, erro: "Produto não encontrado." };

    const atual = Number(prod.estoque);
    const delta = saldo - atual;
    if (delta === 0) return { ok: true, estoque: atual };

    await prisma.$transaction([
      prisma.produto.update({ where: { id: produtoId }, data: { estoque: saldo } }),
      prisma.movimentoEstoque.create({
        data: {
          empresaId, produtoId, tipo: "AJUSTE",
          quantidade: Math.abs(delta), saldoApos: saldo,
          motivo: motivo?.trim() || "Ajuste manual",
        },
      }),
    ]);
    return { ok: true, estoque: saldo };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type MovimentoEstoqueRow = {
  id: string;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
  saldoApos: number;
  motivo: string | null;
  notaId: string | null;
  createdAt: string;
};

// Histórico de movimentos de um produto (mais recentes primeiro).
export async function listarMovimentosEstoque(produtoId: string): Promise<MovimentoEstoqueRow[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.movimentoEstoque.findMany({
    where: { empresaId, produtoId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    quantidade: Number(m.quantidade),
    saldoApos: Number(m.saldoApos),
    motivo: m.motivo,
    notaId: m.notaId,
    createdAt: m.createdAt.toISOString(),
  }));
}

// codigo = só dígitos. completo = true quando tem 8 dígitos (válido p/ NF-e);
// false = posição geral (capítulo/posição), serve só pra refinar a busca.
export type NcmSugestao = { codigo: string; descricao: string; completo: boolean };

// Busca NCMs oficiais por termo na tabela da BrasilAPI (grátis, sem chave).
export async function buscarNcm(termo: string): Promise<NcmSugestao[]> {
  const q = termo.trim();
  if (q.length < 2) return [];
  try {
    const resp = await fetch(
      `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return [];
    const dados = (await resp.json()) as Array<{ codigo?: string; descricao?: string }>;
    return dados
      .filter((d) => d.codigo && d.descricao)
      .map((d) => {
        const digitos = d.codigo!.replace(/\D/g, "");
        // Remove tags HTML e asteriscos da descrição oficial.
        const descricao = d.descricao!.replace(/<[^>]+>/g, "").replace(/\*/g, "").trim();
        return { codigo: digitos, descricao, completo: digitos.length === 8 };
      })
      .filter((d) => d.codigo.length >= 2 && d.codigo.length <= 8)
      // 8 dígitos primeiro, depois por código.
      .sort((a, b) => Number(b.completo) - Number(a.completo) || a.codigo.localeCompare(b.codigo))
      .slice(0, 40);
  } catch {
    return [];
  }
}
