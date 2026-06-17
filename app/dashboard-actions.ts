"use server";

import { prisma } from "@/lib/prisma";
import { empresaAtivaId } from "@/lib/empresa";

export type ResumoDashboard = {
  produtos: number;
  clientes: number;
  transportadoras: number;
  notasAutorizadas: number;
  faturado: number;
  recentes: {
    id: string;
    numero: number;
    clienteNome: string;
    tipoNota: string;
    emitidaEm: string;
    valorTotal: number;
    status: "autorizada" | "rascunho" | "cancelada" | "rejeitada" | "denegada";
  }[];
  serieMensal: { mes: string; notas: number; faturado: number }[];
  distribuicaoStatus: { status: string; qtd: number }[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const STATUS_UI: Record<string, ResumoDashboard["recentes"][number]["status"]> = {
  RASCUNHO: "rascunho", AUTORIZADA: "autorizada", CANCELADA: "cancelada",
  REJEITADA: "rejeitada", DENEGADA: "denegada",
};

const RESUMO_VAZIO: ResumoDashboard = {
  produtos: 0, clientes: 0, transportadoras: 0, notasAutorizadas: 0, faturado: 0,
  recentes: [], serieMensal: [], distribuicaoStatus: [],
};

export async function resumoDashboard(): Promise<ResumoDashboard> {
  try {
    return await resumoInterno();
  } catch {
    // Nunca derruba o render do painel por falha de consulta.
    return RESUMO_VAZIO;
  }
}

async function resumoInterno(): Promise<ResumoDashboard> {
  const empresaId = await empresaAtivaId();
  if (!empresaId) return RESUMO_VAZIO;

  // Janela dos últimos 6 meses para a série temporal.
  const agora = new Date();
  const inicioJanela = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);

  const [produtos, clientes, transportadoras, autorizadas, agg, recentesRows, porStatus, notasJanela] = await Promise.all([
    prisma.produto.count({ where: { empresaId } }),
    prisma.cliente.count({ where: { empresaId } }),
    prisma.transportadora.count({ where: { empresaId } }),
    prisma.nota.count({ where: { emitenteId: empresaId, status: "AUTORIZADA" } }),
    prisma.nota.aggregate({
      where: { emitenteId: empresaId, status: "AUTORIZADA" },
      _sum: { valorTotal: true },
    }),
    prisma.nota.findMany({
      where: { emitenteId: empresaId },
      orderBy: { emitidaEm: "desc" },
      take: 5,
      include: { cliente: true },
    }),
    prisma.nota.groupBy({
      by: ["status"],
      where: { emitenteId: empresaId },
      _count: { _all: true },
    }),
    prisma.nota.findMany({
      where: { emitenteId: empresaId, emitidaEm: { gte: inicioJanela } },
      select: { emitidaEm: true, valorTotal: true, status: true },
    }),
  ]);

  // Buckets dos últimos 6 meses.
  const buckets: { mes: string; chave: string; notas: number; faturado: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    buckets.push({ mes: MESES[d.getMonth()], chave: `${d.getFullYear()}-${d.getMonth()}`, notas: 0, faturado: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.chave, i]));
  for (const n of notasJanela) {
    const d = n.emitidaEm;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(k);
    if (i === undefined) continue;
    buckets[i].notas += 1;
    if (n.status === "AUTORIZADA") buckets[i].faturado += Number(n.valorTotal);
  }

  return {
    serieMensal: buckets.map((b) => ({ mes: b.mes, notas: b.notas, faturado: b.faturado })),
    distribuicaoStatus: porStatus.map((s) => ({ status: STATUS_UI[s.status] ?? "rascunho", qtd: s._count._all })),
    produtos,
    clientes,
    transportadoras,
    notasAutorizadas: autorizadas,
    faturado: Number(agg._sum.valorTotal ?? 0),
    recentes: recentesRows.map((n) => ({
      id: n.id,
      numero: n.numero,
      clienteNome: n.cliente.nome,
      tipoNota: n.tipoNota,
      emitidaEm: n.emitidaEm.toISOString(),
      valorTotal: Number(n.valorTotal),
      status: STATUS_UI[n.status] ?? "rascunho",
    })),
  };
}
