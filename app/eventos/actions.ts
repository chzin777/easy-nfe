"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";

export type TipoEvento = "autorizada" | "rejeitada" | "denegada" | "cancelada" | "processando";

export type EventoEmissao = {
  id: string;
  tipo: TipoEvento;
  quando: string; // ISO
  notaId: string;
  numero: number;
  serie: number;
  clienteNome: string;
  valorTotal: number;
  chaveAcesso: string;
  cStat: string | null;
  xMotivo: string | null;
};

// Achata cada nota da empresa nos eventos de emissão que ela gerou (autorização,
// rejeição/denegação, cancelamento, ou rascunho/em processamento), ordenados por data.
export async function listarEventos(): Promise<EventoEmissao[]> {
  const empresaId = await exigirEmpresa();
  const notas = await prisma.nota.findMany({
    where: { emitenteId: empresaId },
    orderBy: { emitidaEm: "desc" },
    include: { cliente: { select: { nome: true } } },
  });

  const eventos: EventoEmissao[] = [];
  for (const n of notas) {
    const base = {
      notaId: n.id,
      numero: n.numero,
      serie: n.serie,
      clienteNome: n.cliente.nome,
      valorTotal: Number(n.valorTotal),
      chaveAcesso: n.chaveAcesso ?? "",
    };

    if (n.autorizadaEm) {
      eventos.push({ ...base, id: `${n.id}:aut`, tipo: "autorizada", quando: n.autorizadaEm.toISOString(), cStat: n.cStat, xMotivo: n.xMotivo });
    }
    if (n.status === "REJEITADA" || n.status === "DENEGADA") {
      eventos.push({
        ...base,
        id: `${n.id}:rej`,
        tipo: n.status === "DENEGADA" ? "denegada" : "rejeitada",
        quando: n.emitidaEm.toISOString(),
        cStat: n.cStat,
        xMotivo: n.xMotivo,
      });
    }
    if (n.canceladaEm) {
      eventos.push({ ...base, id: `${n.id}:canc`, tipo: "cancelada", quando: n.canceladaEm.toISOString(), cStat: null, xMotivo: n.justificativaCancelamento });
    }
    if (n.status === "RASCUNHO") {
      eventos.push({ ...base, id: `${n.id}:proc`, tipo: "processando", quando: n.createdAt.toISOString(), cStat: null, xMotivo: null });
    }
  }

  eventos.sort((a, b) => (a.quando < b.quando ? 1 : -1));
  return eventos;
}
