import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/crypto";
import { carregarCertificado } from "@/lib/nfe/cert";
import { sincronizarDFe } from "./adn";
import type { AmbienteNFSe, DFeDistribuido } from "./types";

// Sincroniza a caixa de entrada de NFS-e da empresa com o ADN e guarda o que
// chegou. O cursor (último NSU lido) fica no emitente, então cada rodada busca
// só o que é novo.

function certDaEmpresa(certData: string | null): { pfxBase64: string; senha: string } {
  if (!certData) {
    throw new Error("Certificado não configurado. Envie o A1 em Configurações › Certificado.");
  }
  return JSON.parse(decriptar(certData)) as { pfxBase64: string; senha: string };
}

function ext(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return m ? m[1].trim() : null;
}

// Recorta o bloco do prestador antes de procurar CNPJ/nome — senão o primeiro
// CNPJ do documento pode ser o do tomador (a própria empresa).
function blocoPrestador(xml: string): string {
  return (
    xml.match(/<emit\b[\s\S]*?<\/emit>/)?.[0] ??
    xml.match(/<prest\b[\s\S]*?<\/prest>/)?.[0] ??
    ""
  );
}

function interpretarDocumento(d: DFeDistribuido) {
  const xml = d.xml ?? "";
  const ehEvento = d.tipoDocumento === "EVENTO";

  // A chave pode vir no campo do lote ou dentro do XML (Id="NFS...").
  const chave =
    d.chaveAcesso ??
    ext(xml, "chNFSe") ??
    xml.match(/Id="NFS?e?(\d{50})"/)?.[1] ??
    null;

  const prest = blocoPrestador(xml);
  const dh = ext(xml, "dhProc") ?? ext(xml, "dhEmi") ?? ext(xml, "dhEvento");

  // vLiq é o líquido da NFS-e; vServ é o bruto do serviço. Um dos dois existe.
  const valorTexto = ext(xml, "vLiq") ?? ext(xml, "vServ") ?? ext(xml, "vServPrest");
  const valor = valorTexto ? Number(valorTexto) : null;

  return {
    chaveAcesso: chave,
    prestadorCnpj: ehEvento ? null : ext(prest, "CNPJ") ?? ext(prest, "CPF"),
    prestadorNome: ehEvento ? null : ext(prest, "xNome") ?? ext(prest, "xFant"),
    valorServico: ehEvento || valor === null || Number.isNaN(valor) ? null : valor,
    emitidaEm: dh ? new Date(dh) : d.geradoEm ?? null,
    descricao: ehEvento
      ? ext(xml, "xDesc") ?? ext(xml, "descEvento") ?? d.tipoEvento ?? null
      : ext(xml, "xDescServ"),
  };
}

export type ResultadoSincNfse =
  | { ok: true; novas: number; total: number; ultNSU: string; completo: boolean; aviso?: string }
  | { ok: false; erro: string };

export async function sincronizarNfseRecebidas(empresaId: string): Promise<ResultadoSincNfse> {
  try {
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });
    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const ambiente: AmbienteNFSe = empresa.ambiente === "PRODUCAO" ? "1" : "2";

    const partida = Number(empresa.adnUltNSU ?? "0");
    const r = await sincronizarDFe(partida, ambiente, cert, { cnpjConsulta: empresa.cnpj });

    let novas = 0;
    for (const d of r.documentos) {
      const p = interpretarDocumento(d);
      const res = await prisma.nfseRecebida.upsert({
        where: { empresaId_nsu: { empresaId, nsu: String(d.nsu) } },
        create: {
          empresaId,
          nsu: String(d.nsu),
          tipoDocumento: d.tipoDocumento,
          tipoEvento: d.tipoEvento ?? null,
          chaveAcesso: p.chaveAcesso,
          prestadorCnpj: p.prestadorCnpj,
          prestadorNome: p.prestadorNome,
          valorServico: p.valorServico ?? undefined,
          emitidaEm: p.emitidaEm ?? undefined,
          descricao: p.descricao,
          xml: d.xml ?? "",
        },
        // Mesmo NSU nunca muda de conteúdo; o update existe só para não quebrar
        // se a sincronização for repetida.
        update: { xml: d.xml ?? "" },
      });
      if (res.createdAt.getTime() === res.updatedAt.getTime()) novas++;
    }

    // O cursor avança mesmo quando a busca falhou no meio: o que já foi gravado
    // não precisa ser buscado de novo.
    await prisma.emitente.update({
      where: { id: empresaId },
      data: { adnUltNSU: String(r.ultimoNSU), adnSincNSUEm: new Date() },
    });

    if (!r.ok) {
      return novas > 0
        ? { ok: true, novas, total: r.documentos.length, ultNSU: String(r.ultimoNSU), completo: false, aviso: r.erro }
        : { ok: false, erro: r.erro };
    }

    return { ok: true, novas, total: r.documentos.length, ultNSU: String(r.ultimoNSU), completo: r.completo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}
