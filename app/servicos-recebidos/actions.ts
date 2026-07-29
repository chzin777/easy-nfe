"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { sincronizarNfseRecebidas, type ResultadoSincNfse } from "@/lib/nfse/distribuicao";

// Nomes dos eventos em português. Os códigos crus do fisco não servem para tela.
const NOME_EVENTO: Record<string, string> = {
  CANCELAMENTO: "Cancelada",
  SOLICITACAO_CANCELAMENTO_ANALISE_FISCAL: "Cancelamento em análise",
  CANCELAMENTO_POR_SUBSTITUICAO: "Substituída",
  CANCELAMENTO_DEFERIDO_ANALISE_FISCAL: "Cancelamento deferido",
  CANCELAMENTO_INDEFERIDO_ANALISE_FISCAL: "Cancelamento indeferido",
  CONFIRMACAO_PRESTADOR: "Confirmada pelo prestador",
  REJEICAO_PRESTADOR: "Rejeitada pelo prestador",
  CONFIRMACAO_TOMADOR: "Confirmada por você",
  REJEICAO_TOMADOR: "Rejeitada por você",
  CONFIRMACAO_INTERMEDIARIO: "Confirmada pelo intermediário",
  REJEICAO_INTERMEDIARIO: "Rejeitada pelo intermediário",
  CONFIRMACAO_TACITA: "Confirmada automaticamente",
  ANULACAO_REJEICAO: "Rejeição anulada",
  CANCELAMENTO_POR_OFICIO: "Cancelada de ofício",
  BLOQUEIO_POR_OFICIO: "Bloqueada de ofício",
  DESBLOQUEIO_POR_OFICIO: "Desbloqueada",
  INCLUSAO_NFSE_DAN: "Incluída no DAN",
  TRIBUTOS_NFSE_RECOLHIDOS: "Tributos recolhidos",
};

export async function sincronizarServicosRecebidos(): Promise<ResultadoSincNfse> {
  try {
    await exigirFeature("dfe");
    const empresaId = await exigirEmpresa();
    return await sincronizarNfseRecebidas(empresaId);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type EventoUI = { tipo: string; rotulo: string; em: string | null };

export type ServicoRecebidoUI = {
  id: string;
  nsu: string;
  // "nfse" = documento de nota. "evento" = acontecimento avulso, que chegou sem
  // a nota correspondente na caixa.
  tipo: "nfse" | "evento";
  chaveAcesso: string;
  prestadorNome: string;
  prestadorCnpj: string;
  valor: number | null;
  emitidaEm: string | null;
  descricao: string | null;
  // Situação derivada dos eventos ligados à nota. Vazio = sem novidade.
  situacao: string | null;
  situacaoTom: "neutral" | "danger" | "success" | "warning";
  eventos: EventoUI[];
};

export type ResumoSincNfse = {
  ultNSU: string | null;
  sincronizadaEm: string | null;
  total: number;
};

// Eventos que mudam a validade da nota — ganham destaque na lista.
const CANCELA = /^CANCELAMENTO|^BLOQUEIO/;
const CONFIRMA = /^CONFIRMACAO/;
const REJEITA = /^REJEICAO/;

function tomDoEvento(tipo: string): ServicoRecebidoUI["situacaoTom"] {
  if (CANCELA.test(tipo)) return "danger";
  if (REJEITA.test(tipo)) return "warning";
  if (CONFIRMA.test(tipo)) return "success";
  return "neutral";
}

export async function listarServicosRecebidos(): Promise<{
  docs: ServicoRecebidoUI[];
  resumo: ResumoSincNfse;
}> {
  const empresaId = await exigirEmpresa();
  const [empresa, registros] = await Promise.all([
    prisma.emitente.findUniqueOrThrow({
      where: { id: empresaId },
      select: { adnUltNSU: true, adnSincNSUEm: true },
    }),
    prisma.nfseRecebida.findMany({
      where: { empresaId },
      orderBy: { emitidaEm: "desc" },
      // O XML fica de fora da listagem — é grande e só é usado no download.
      select: {
        id: true, nsu: true, tipoDocumento: true, tipoEvento: true,
        chaveAcesso: true, prestadorCnpj: true, prestadorNome: true,
        valorServico: true, emitidaEm: true, descricao: true,
      },
    }),
  ]);

  const eventos = registros.filter((r) => r.tipoDocumento === "EVENTO");
  const notas = registros.filter((r) => r.tipoDocumento !== "EVENTO");

  // Um evento pertence à nota de mesma chave. Sem chave — ou com chave que não
  // está na caixa — ele vira linha própria, para não sumir da tela.
  const chavesComNota = new Set(notas.map((n) => n.chaveAcesso).filter(Boolean));
  const porChave = new Map<string, typeof eventos>();
  for (const e of eventos) {
    if (!e.chaveAcesso || !chavesComNota.has(e.chaveAcesso)) continue;
    const atual = porChave.get(e.chaveAcesso) ?? [];
    atual.push(e);
    porChave.set(e.chaveAcesso, atual);
  }

  const linhasNota: ServicoRecebidoUI[] = notas.map((n) => {
    const meus = (n.chaveAcesso ? porChave.get(n.chaveAcesso) : undefined) ?? [];
    const ordenados = [...meus].sort(
      (a, b) => (a.emitidaEm?.getTime() ?? 0) - (b.emitidaEm?.getTime() ?? 0),
    );
    // A situação é a do evento mais recente — cancelar depois de confirmar
    // manda no que aparece na linha.
    const ultimo = ordenados[ordenados.length - 1];
    return {
      id: n.id,
      nsu: n.nsu,
      tipo: "nfse",
      chaveAcesso: n.chaveAcesso ?? "",
      prestadorNome: n.prestadorNome ?? "—",
      prestadorCnpj: n.prestadorCnpj ?? "",
      valor: n.valorServico ? Number(n.valorServico) : null,
      emitidaEm: n.emitidaEm?.toISOString() ?? null,
      descricao: n.descricao,
      situacao: ultimo?.tipoEvento ? NOME_EVENTO[ultimo.tipoEvento] ?? ultimo.tipoEvento : null,
      situacaoTom: ultimo?.tipoEvento ? tomDoEvento(ultimo.tipoEvento) : "neutral",
      eventos: ordenados.map((e) => ({
        tipo: e.tipoEvento ?? "",
        rotulo: e.tipoEvento ? NOME_EVENTO[e.tipoEvento] ?? e.tipoEvento : "Evento",
        em: e.emitidaEm?.toISOString() ?? null,
      })),
    };
  });

  const orfaos: ServicoRecebidoUI[] = eventos
    .filter((e) => !e.chaveAcesso || !chavesComNota.has(e.chaveAcesso))
    .map((e) => ({
      id: e.id,
      nsu: e.nsu,
      tipo: "evento",
      chaveAcesso: e.chaveAcesso ?? "",
      prestadorNome: "—",
      prestadorCnpj: "",
      valor: null,
      emitidaEm: e.emitidaEm?.toISOString() ?? null,
      descricao: e.descricao,
      situacao: e.tipoEvento ? NOME_EVENTO[e.tipoEvento] ?? e.tipoEvento : "Evento",
      situacaoTom: e.tipoEvento ? tomDoEvento(e.tipoEvento) : "neutral",
      eventos: [],
    }));

  const docs = [...linhasNota, ...orfaos].sort(
    (a, b) => (b.emitidaEm ?? "").localeCompare(a.emitidaEm ?? ""),
  );

  return {
    docs,
    resumo: {
      ultNSU: empresa.adnUltNSU,
      sincronizadaEm: empresa.adnSincNSUEm?.toISOString() ?? null,
      total: notas.length,
    },
  };
}

// XML bruto para download. Fica fora da listagem por causa do tamanho.
export async function obterXmlServicoRecebido(
  id: string,
): Promise<{ ok: true; xml: string; nome: string } | { ok: false; erro: string }> {
  const empresaId = await exigirEmpresa();
  const doc = await prisma.nfseRecebida.findFirst({
    where: { id, empresaId },
    select: { xml: true, chaveAcesso: true, nsu: true },
  });
  if (!doc) return { ok: false, erro: "Documento não encontrado." };
  return { ok: true, xml: doc.xml, nome: `${doc.chaveAcesso || `nsu-${doc.nsu}`}.xml` };
}
