import { NextResponse } from "next/server";
import { autenticarApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /v1/produtos — lista os produtos da empresa dona da API key.
// Auth: header `Authorization: Bearer <token>` ou `x-api-key: <token>`.
export async function GET(req: Request) {
  const empresaId = await autenticarApiKey(req);
  if (!empresaId) {
    return NextResponse.json({ erro: "API key inválida ou ausente." }, { status: 401 });
  }

  const rows = await prisma.produto.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
    include: { categoria: { select: { nome: true } } },
  });

  const produtos = rows.map((p) => ({
    id: p.id,
    codigo: p.codigoInterno,
    gtin: p.codigoBarras ?? null,
    nome: p.nome,
    marca: p.marca ?? null,
    categoria: p.categoria?.nome ?? null,
    unidade: p.unidade,
    ncm: p.ncm,
    preco: Number(p.preco),
    custo: p.precoCusto == null ? null : Number(p.precoCusto),
    estoque: p.controlaEstoque ? Number(p.estoque) : null,
  }));

  return NextResponse.json({ total: produtos.length, produtos });
}
