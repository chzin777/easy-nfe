"use server";

import { carregarCertificado } from "@/lib/nfe";
import {
  consultarDFe,
  manifestarDestinatario,
  type DocDFe,
  type TipoManifesto,
} from "@/lib/nfe/dfe";
import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { decriptar } from "@/lib/crypto";
import { exigirFeature } from "@/lib/permissoes";
import { sincronizarNfseRecebidas } from "@/lib/nfse/distribuicao";

// Certificado A1 (PFX+senha) armazenado criptografado na empresa.
function certDaEmpresa(certData: string | null): { pfxBase64: string; senha: string } {
  if (!certData) {
    throw new Error("Certificado não configurado. Envie o A1 em Configurações › Certificado.");
  }
  return JSON.parse(decriptar(certData)) as { pfxBase64: string; senha: string };
}

// Código IBGE da UF (cUFAutor exigido na consulta DFe).
const UF_IBGE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

function ext(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return m ? m[1].trim() : null;
}

function blocoEmit(xml: string): string {
  return xml.match(/<emit\b[\s\S]*?<\/emit>/)?.[0] ?? "";
}

// Interpreta um documento da Distribuição DFe num registro de nota recebida.
function parseDoc(doc: DocDFe): {
  tipoDoc: string;
  chaveAcesso: string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  valorTotal: number | null;
  emitidaEm: Date | null;
  descricao: string | null;
} {
  const s = doc.schema.toLowerCase();
  const ehEvento = s.includes("evento");
  const ehNfeCompleta = s.includes("procnfe") || s.includes("nfeproc");
  const tipoDoc = ehEvento ? "evento" : ehNfeCompleta ? "nfe" : "resumo";

  // chave: <chNFe> nos resumos/eventos, ou Id="NFe..." na nota completa.
  const chave =
    ext(doc.xml, "chNFe") ??
    doc.xml.match(/Id="NFe(\d{44})"/)?.[1] ??
    null;

  const dh = ext(doc.xml, "dhEmi") ?? ext(doc.xml, "dhEvento") ?? ext(doc.xml, "dhRecbto");
  const emitidaEm = dh ? new Date(dh) : null;

  if (ehEvento) {
    const desc = ext(doc.xml, "descEvento") ?? ext(doc.xml, "tpEvento");
    return {
      tipoDoc, chaveAcesso: chave, emitenteCnpj: null, emitenteNome: null,
      valorTotal: null, emitidaEm, descricao: desc,
    };
  }

  // Resumo (resNFe) traz CNPJ/xNome no nível raiz; nota completa, dentro de <emit>.
  const escopo = ehNfeCompleta ? blocoEmit(doc.xml) : doc.xml;
  const cnpj = ext(escopo, "CNPJ") ?? ext(doc.xml, "CNPJ");
  const nome = ext(escopo, "xNome") ?? ext(doc.xml, "xNome");
  const vNF = ext(doc.xml, "vNF");

  return {
    tipoDoc,
    chaveAcesso: chave,
    emitenteCnpj: cnpj,
    emitenteNome: nome,
    valorTotal: vNF ? Number(vNF) : null,
    emitidaEm,
    descricao: null,
  };
}

export type SincResultado =
  | { ok: true; novas: number; total: number; ultNSU: string; maxNSU: string; aviso?: string }
  | { ok: false; erro: string };

// Sincroniza com a SEFAZ: consulta a Distribuição DFe a partir do último NSU
// conhecido, em lotes, até esgotar (ultNSU == maxNSU) ou atingir o limite de
// iterações. Persiste cada documento e avança o cursor da empresa.
export async function sincronizarRecebidas(): Promise<SincResultado> {
  try {
    await exigirFeature("dfe");
    const empresaId = await exigirEmpresa();
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });

    const cUF = UF_IBGE[empresa.uf];
    if (!cUF) return { ok: false, erro: `UF do emitente inválida: ${empresa.uf}` };

    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const tpAmb = empresa.ambiente === "PRODUCAO" ? "1" : "2";

    let ultNSU = empresa.dfeUltNSU ?? "0";
    let maxNSU = empresa.dfeMaxNSU ?? "0";
    let novas = 0;
    let total = 0;
    let aviso: string | undefined;

    // Cap de 20 lotes por sincronização (≈1000 docs) — evita loop longo e respeita a SEFAZ.
    for (let i = 0; i < 20; i++) {
      const r = await consultarDFe(cert, { tpAmb, cUF, cnpj: empresa.cnpj, ultNSU });

      // 656 = consumo indevido (consultas frequentes demais). Para e avisa.
      if (r.cStat === "656") {
        aviso = "SEFAZ: consumo indevido — aguarde ~1h antes de sincronizar novamente.";
        break;
      }
      if (!r.ok && r.docs.length === 0) {
        if (i === 0) return { ok: false, erro: `SEFAZ (cStat ${r.cStat}): ${r.xMotivo ?? "sem retorno"}` };
        break;
      }

      maxNSU = r.maxNSU;
      total += r.docs.length;

      for (const doc of r.docs) {
        const p = parseDoc(doc);
        const res = await prisma.notaRecebida.upsert({
          where: { empresaId_nsu: { empresaId, nsu: doc.nsu } },
          create: {
            empresaId, nsu: doc.nsu, schema: doc.schema, tipoDoc: p.tipoDoc,
            chaveAcesso: p.chaveAcesso, emitenteCnpj: p.emitenteCnpj, emitenteNome: p.emitenteNome,
            valorTotal: p.valorTotal ?? undefined, emitidaEm: p.emitidaEm ?? undefined,
            descricao: p.descricao, xml: doc.xml,
          },
          update: {
            // Documento completo (procNFe) substitui o resumo anterior da mesma nota.
            schema: doc.schema, tipoDoc: p.tipoDoc, xml: doc.xml,
            chaveAcesso: p.chaveAcesso ?? undefined,
            emitenteNome: p.emitenteNome ?? undefined,
            valorTotal: p.valorTotal ?? undefined,
          },
        });
        if (res.createdAt.getTime() === res.updatedAt.getTime()) novas++;
      }

      // Avança o cursor. Quando ultNSU alcança maxNSU não há mais documentos novos.
      const anterior = ultNSU;
      ultNSU = r.ultNSU;
      if (r.docs.length === 0 || ultNSU === anterior || BigInt(ultNSU) >= BigInt(maxNSU)) break;
    }

    await prisma.emitente.update({
      where: { id: empresaId },
      data: { dfeUltNSU: ultNSU, dfeMaxNSU: maxNSU, dfeSincNSUEm: new Date() },
    });

    return { ok: true, novas, total, ultNSU, maxNSU, aviso };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

export type RecebidaUI = {
  id: string;
  nsu: string;
  tipoDoc: string;
  chaveAcesso: string;
  emitenteNome: string;
  emitenteCnpj: string;
  valorTotal: number | null;
  emitidaEm: string | null;
  descricao: string | null;
  manifestacao: string;
  manifestadaEm: string | null;
};

export type ResumoSinc = {
  ultNSU: string | null;
  maxNSU: string | null;
  sincronizadaEm: string | null;
  pendentes: number;
};

export async function listarRecebidas(): Promise<{ docs: RecebidaUI[]; resumo: ResumoSinc }> {
  const empresaId = await exigirEmpresa();
  const [empresa, registros] = await Promise.all([
    prisma.emitente.findUniqueOrThrow({
      where: { id: empresaId },
      select: { dfeUltNSU: true, dfeMaxNSU: true, dfeSincNSUEm: true },
    }),
    prisma.notaRecebida.findMany({
      where: { empresaId },
      orderBy: { nsu: "desc" },
    }),
  ]);

  const docs: RecebidaUI[] = registros.map((r) => ({
    id: r.id,
    nsu: r.nsu,
    tipoDoc: r.tipoDoc,
    chaveAcesso: r.chaveAcesso ?? "",
    emitenteNome: r.emitenteNome ?? "—",
    emitenteCnpj: r.emitenteCnpj ?? "",
    valorTotal: r.valorTotal != null ? Number(r.valorTotal) : null,
    emitidaEm: r.emitidaEm?.toISOString() ?? null,
    descricao: r.descricao,
    manifestacao: r.manifestacao,
    manifestadaEm: r.manifestadaEm?.toISOString() ?? null,
  }));

  const pendentes = registros.filter(
    (r) => r.tipoDoc !== "evento" && r.chaveAcesso && r.manifestacao === "PENDENTE",
  ).length;

  return {
    docs,
    resumo: {
      ultNSU: empresa.dfeUltNSU,
      maxNSU: empresa.dfeMaxNSU,
      sincronizadaEm: empresa.dfeSincNSUEm?.toISOString() ?? null,
      pendentes,
    },
  };
}

const TIPO_ENUM: Record<TipoManifesto, "CIENCIA" | "CONFIRMACAO" | "DESCONHECIMENTO" | "NAO_REALIZADA"> = {
  "210210": "CIENCIA",
  "210200": "CONFIRMACAO",
  "210220": "DESCONHECIMENTO",
  "210240": "NAO_REALIZADA",
};

export type ManifestarInput = { notaId: string; tipo: TipoManifesto; justificativa?: string };
export type ManifestarResultado =
  | { ok: boolean; cStat: string | null; xMotivo: string | null }
  | { ok: false; erro: string };

// Manifesta o destinatário sobre uma nota recebida e grava o resultado.
export async function manifestar(input: ManifestarInput): Promise<ManifestarResultado> {
  try {
    await exigirFeature("dfe");
    const empresaId = await exigirEmpresa();

    if (input.tipo === "210240" && (input.justificativa ?? "").trim().length < 15) {
      return { ok: false, erro: "Justificativa de no mínimo 15 caracteres é obrigatória." };
    }

    const nota = await prisma.notaRecebida.findFirst({
      where: { id: input.notaId, empresaId },
      include: { empresa: true },
    });
    if (!nota || !nota.chaveAcesso) {
      return { ok: false, erro: "Documento não encontrado ou sem chave de acesso (não manifestável)." };
    }

    const { pfxBase64, senha } = certDaEmpresa(nota.empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);

    const r = await manifestarDestinatario(cert, {
      tpAmb: nota.empresa.ambiente === "PRODUCAO" ? "1" : "2",
      cnpj: nota.empresa.cnpj,
      chave: nota.chaveAcesso,
      tipo: input.tipo,
      justificativa: input.justificativa,
    });

    if (r.ok) {
      await prisma.notaRecebida.update({
        where: { id: nota.id },
        data: {
          manifestacao: TIPO_ENUM[input.tipo],
          manifestadaEm: new Date(),
          protocoloManifesto: r.nProt,
        },
      });
    }
    return { ok: r.ok, cStat: r.cStat, xMotivo: r.xMotivo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

// XML bruto de um documento recebido (para download).
export async function baixarXmlRecebida(notaId: string): Promise<{ ok: boolean; xml?: string; nome?: string; erro?: string }> {
  try {
    const empresaId = await exigirEmpresa();
    const nota = await prisma.notaRecebida.findFirst({ where: { id: notaId, empresaId } });
    if (!nota) return { ok: false, erro: "Documento não encontrado." };
    const nome = (nota.chaveAcesso || nota.nsu) + ".xml";
    return { ok: true, xml: nota.xml, nome };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Caixa de entrada única: nota de produto (NF-e, via SEFAZ) e nota de serviço
// (NFS-e, via ADN) na mesma lista. São duas filas independentes, com numeração
// e transporte próprios — o que se junta é só a apresentação.
// ----------------------------------------------------------------------------

// Nomes dos eventos da NFS-e em português. Os códigos crus não servem p/ tela.
const NOME_EVENTO_NFSE: Record<string, string> = {
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

const NOME_MANIFESTO: Record<string, string> = {
  CIENCIA: "Ciência dada",
  CONFIRMACAO: "Operação confirmada",
  DESCONHECIMENTO: "Operação desconhecida",
  NAO_REALIZADA: "Operação não realizada",
};

export type TomSituacao = "neutral" | "danger" | "success" | "warning";

function tomEventoNfse(tipo: string): TomSituacao {
  if (/^CANCELAMENTO|^BLOQUEIO/.test(tipo)) return "danger";
  if (/^REJEICAO/.test(tipo)) return "warning";
  if (/^CONFIRMACAO/.test(tipo)) return "success";
  return "neutral";
}

export type EventoUI = { rotulo: string; em: string | null };

export type EntradaUI = {
  // Prefixado pela origem — os dois bancos têm ids próprios e a tabela precisa
  // de chave única entre as duas listas juntas.
  id: string;
  origem: "produto" | "servico";
  // Acontecimento que chegou sem a nota correspondente na caixa.
  avulso: boolean;
  nsu: string;
  chaveAcesso: string;
  contraparteNome: string;
  contraparteDoc: string;
  descricao: string | null;
  valor: number | null;
  emitidaEm: string | null;
  situacao: string | null;
  situacaoTom: TomSituacao;
  eventos: EventoUI[];
  // Só nota de produto é manifestável, e só quando ainda está pendente.
  manifestavel: boolean;
};

export type ResumoEntradas = {
  sincronizadaEm: string | null;
  produtos: number;
  servicos: number;
  pendentes: number;
};

export async function listarEntradas(): Promise<{ docs: EntradaUI[]; resumo: ResumoEntradas }> {
  const empresaId = await exigirEmpresa();
  const [empresa, nfe, nfse] = await Promise.all([
    prisma.emitente.findUniqueOrThrow({
      where: { id: empresaId },
      select: { dfeSincNSUEm: true, adnSincNSUEm: true },
    }),
    prisma.notaRecebida.findMany({
      where: { empresaId },
      select: {
        id: true, nsu: true, tipoDoc: true, chaveAcesso: true, emitenteCnpj: true,
        emitenteNome: true, valorTotal: true, emitidaEm: true, descricao: true,
        manifestacao: true,
      },
    }),
    prisma.nfseRecebida.findMany({
      where: { empresaId },
      select: {
        id: true, nsu: true, tipoDocumento: true, tipoEvento: true, chaveAcesso: true,
        prestadorCnpj: true, prestadorNome: true, valorServico: true, emitidaEm: true,
        descricao: true,
      },
    }),
  ]);

  // --- nota de produto ---
  const eventosNfe = nfe.filter((r) => r.tipoDoc === "evento");
  const notasNfe = nfe.filter((r) => r.tipoDoc !== "evento");
  const chavesNfe = new Set(notasNfe.map((n) => n.chaveAcesso).filter(Boolean));

  const porChaveNfe = new Map<string, typeof eventosNfe>();
  for (const e of eventosNfe) {
    if (!e.chaveAcesso || !chavesNfe.has(e.chaveAcesso)) continue;
    const atual = porChaveNfe.get(e.chaveAcesso) ?? [];
    atual.push(e);
    porChaveNfe.set(e.chaveAcesso, atual);
  }

  const linhasNfe: EntradaUI[] = notasNfe.map((n) => {
    const meus = [...((n.chaveAcesso ? porChaveNfe.get(n.chaveAcesso) : undefined) ?? [])].sort(
      (a, b) => (a.emitidaEm?.getTime() ?? 0) - (b.emitidaEm?.getTime() ?? 0),
    );
    const ultimo = meus[meus.length - 1];
    // Evento do fisco manda na situação; sem evento, vale o que você declarou.
    const situacao =
      ultimo?.descricao ??
      (n.manifestacao !== "PENDENTE" ? NOME_MANIFESTO[n.manifestacao] ?? n.manifestacao : null);
    const cancelada = !!ultimo?.descricao && /cancel/i.test(ultimo.descricao);
    return {
      id: `produto:${n.id}`,
      origem: "produto",
      avulso: false,
      nsu: n.nsu,
      chaveAcesso: n.chaveAcesso ?? "",
      contraparteNome: n.emitenteNome ?? "—",
      contraparteDoc: n.emitenteCnpj ?? "",
      // Resumo é o aviso da nota, sem o conteúdo dela — vale dizer na tela.
      descricao: n.tipoDoc === "resumo" ? "Somente o resumo da nota" : "Nota completa",
      valor: n.valorTotal != null ? Number(n.valorTotal) : null,
      emitidaEm: n.emitidaEm?.toISOString() ?? null,
      situacao,
      situacaoTom: cancelada ? "danger" : situacao ? "success" : "neutral",
      eventos: meus.map((e) => ({ rotulo: e.descricao ?? "Evento", em: e.emitidaEm?.toISOString() ?? null })),
      manifestavel: !!n.chaveAcesso && n.manifestacao === "PENDENTE",
    };
  });

  const orfaosNfe: EntradaUI[] = eventosNfe
    .filter((e) => !e.chaveAcesso || !chavesNfe.has(e.chaveAcesso))
    .map((e) => ({
      id: `produto:${e.id}`,
      origem: "produto",
      avulso: true,
      nsu: e.nsu,
      chaveAcesso: e.chaveAcesso ?? "",
      contraparteNome: "—",
      contraparteDoc: "",
      descricao: e.descricao,
      valor: null,
      emitidaEm: e.emitidaEm?.toISOString() ?? null,
      situacao: e.descricao ?? "Evento",
      situacaoTom: e.descricao && /cancel/i.test(e.descricao) ? "danger" : "neutral",
      eventos: [],
      manifestavel: false,
    }));

  // --- nota de serviço ---
  const eventosNfse = nfse.filter((r) => r.tipoDocumento === "EVENTO");
  const notasNfse = nfse.filter((r) => r.tipoDocumento !== "EVENTO");
  const chavesNfse = new Set(notasNfse.map((n) => n.chaveAcesso).filter(Boolean));

  const porChaveNfse = new Map<string, typeof eventosNfse>();
  for (const e of eventosNfse) {
    if (!e.chaveAcesso || !chavesNfse.has(e.chaveAcesso)) continue;
    const atual = porChaveNfse.get(e.chaveAcesso) ?? [];
    atual.push(e);
    porChaveNfse.set(e.chaveAcesso, atual);
  }

  const rotuloEvento = (tipo: string | null) =>
    tipo ? NOME_EVENTO_NFSE[tipo] ?? tipo : "Evento";

  const linhasNfse: EntradaUI[] = notasNfse.map((n) => {
    const meus = [...((n.chaveAcesso ? porChaveNfse.get(n.chaveAcesso) : undefined) ?? [])].sort(
      (a, b) => (a.emitidaEm?.getTime() ?? 0) - (b.emitidaEm?.getTime() ?? 0),
    );
    const ultimo = meus[meus.length - 1];
    return {
      id: `servico:${n.id}`,
      origem: "servico",
      avulso: false,
      nsu: n.nsu,
      chaveAcesso: n.chaveAcesso ?? "",
      contraparteNome: n.prestadorNome ?? "—",
      contraparteDoc: n.prestadorCnpj ?? "",
      descricao: n.descricao,
      valor: n.valorServico != null ? Number(n.valorServico) : null,
      emitidaEm: n.emitidaEm?.toISOString() ?? null,
      situacao: ultimo ? rotuloEvento(ultimo.tipoEvento) : null,
      situacaoTom: ultimo?.tipoEvento ? tomEventoNfse(ultimo.tipoEvento) : "neutral",
      eventos: meus.map((e) => ({
        rotulo: rotuloEvento(e.tipoEvento),
        em: e.emitidaEm?.toISOString() ?? null,
      })),
      manifestavel: false,
    };
  });

  const orfaosNfse: EntradaUI[] = eventosNfse
    .filter((e) => !e.chaveAcesso || !chavesNfse.has(e.chaveAcesso))
    .map((e) => ({
      id: `servico:${e.id}`,
      origem: "servico",
      avulso: true,
      nsu: e.nsu,
      chaveAcesso: e.chaveAcesso ?? "",
      contraparteNome: "—",
      contraparteDoc: "",
      descricao: e.descricao,
      valor: null,
      emitidaEm: e.emitidaEm?.toISOString() ?? null,
      situacao: rotuloEvento(e.tipoEvento),
      situacaoTom: e.tipoEvento ? tomEventoNfse(e.tipoEvento) : "neutral",
      eventos: [],
      manifestavel: false,
    }));

  const docs = [...linhasNfe, ...orfaosNfe, ...linhasNfse, ...orfaosNfse].sort(
    (a, b) => (b.emitidaEm ?? "").localeCompare(a.emitidaEm ?? ""),
  );

  // A busca mais antiga das duas manda no rótulo — é até onde a caixa está
  // realmente em dia.
  const datas = [empresa.dfeSincNSUEm, empresa.adnSincNSUEm];
  const sincronizadaEm = datas.some((d) => !d)
    ? null
    : new Date(Math.min(...datas.map((d) => d!.getTime()))).toISOString();

  return {
    docs,
    resumo: {
      sincronizadaEm,
      produtos: linhasNfe.length,
      servicos: linhasNfse.length,
      pendentes: linhasNfe.filter((l) => l.manifestavel).length,
    },
  };
}

export type SincEntradas = {
  produto: { ok: boolean; novas: number; erro?: string };
  servico: { ok: boolean; novas: number; erro?: string };
};

// Busca as duas filas numa tacada. Uma falhando não impede a outra — são
// serviços independentes, e meia caixa atualizada é melhor que nenhuma.
export async function sincronizarEntradas(): Promise<SincEntradas> {
  const [nfe, nfse] = await Promise.all([
    sincronizarRecebidas(),
    sincronizarServicos(),
  ]);
  return {
    produto: nfe.ok ? { ok: true, novas: nfe.novas } : { ok: false, novas: 0, erro: nfe.erro },
    servico: nfse.ok ? { ok: true, novas: nfse.novas } : { ok: false, novas: 0, erro: nfse.erro },
  };
}

async function sincronizarServicos() {
  try {
    await exigirFeature("dfe");
    const empresaId = await exigirEmpresa();
    return await sincronizarNfseRecebidas(empresaId);
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : String(e) };
  }
}

// XML bruto de qualquer documento da caixa, produto ou serviço.
export async function baixarXmlEntrada(
  id: string,
): Promise<{ ok: true; xml: string; nome: string } | { ok: false; erro: string }> {
  try {
    const empresaId = await exigirEmpresa();
    const [origem, real] = id.split(":");

    if (origem === "servico") {
      const doc = await prisma.nfseRecebida.findFirst({
        where: { id: real, empresaId },
        select: { xml: true, chaveAcesso: true, nsu: true },
      });
      if (!doc) return { ok: false, erro: "Documento não encontrado." };
      return { ok: true, xml: doc.xml, nome: `${doc.chaveAcesso || `nsu-${doc.nsu}`}.xml` };
    }

    const doc = await prisma.notaRecebida.findFirst({
      where: { id: real, empresaId },
      select: { xml: true, chaveAcesso: true, nsu: true },
    });
    if (!doc) return { ok: false, erro: "Documento não encontrado." };
    return { ok: true, xml: doc.xml, nome: `${doc.chaveAcesso || `nsu-${doc.nsu}`}.xml` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
