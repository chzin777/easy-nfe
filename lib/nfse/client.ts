import type { Certificado } from "@/lib/nfe/cert";
import { assinar } from "@/lib/nfe/sign";
import { deGzipB64, explicarErro, gzipB64, requisicao as http } from "./http";
import { montarDps } from "./xml";
import type { AmbienteNFSe, DadosDPS, ResultadoNFSe } from "./types";

// Transporte da NFS-e Padrão Nacional (SEFIN Nacional).
//
// Autenticação é mTLS com o próprio certificado A1 da empresa — não há token
// nem OAuth. O corpo é JSON com o XML da DPS assinado, comprimido em GZip e
// codificado em Base64.
//
// Endpoints:
//   POST /SefinNacional/nfse                      → emite (síncrono)
//   GET  /SefinNacional/nfse/{chaveAcesso}        → consulta por chave
//   GET  /SefinNacional/dps/{idDps}               → recupera a chave após timeout
//   POST /SefinNacional/nfse/{chave}/eventos      → eventos (cancelamento)
const HOST: Record<AmbienteNFSe, string> = {
  "1": "sefin.nfse.gov.br",
  "2": "sefin.producaorestrita.nfse.gov.br",
};

const VER_APLIC = "EasyNFe";

const requisicao = (
  ambiente: AmbienteNFSe,
  metodo: "GET" | "POST",
  caminho: string,
  cert: Certificado,
  corpo?: string,
) => http(HOST[ambiente], metodo, caminho, cert, corpo);

// Emite a NFS-e: monta a DPS, assina, comprime e transmite.
//
// ATENÇÃO: o XML não pode ser tocado depois de assinado — qualquer alteração,
// inclusive reserializar, invalida a assinatura. Por isso a string assinada vai
// direto para o gzip.
export async function emitirNfse(dados: DadosDPS, cert: Certificado): Promise<ResultadoNFSe> {
  const { xml, id } = montarDps(dados, VER_APLIC);
  const assinado = assinar(xml, id, cert, "infDPS");

  try {
    const r = await requisicao(
      dados.ambiente,
      "POST",
      "/SefinNacional/nfse",
      cert,
      JSON.stringify({ dpsXmlGZipB64: gzipB64(assinado) }),
    );

    if (r.status !== 200 && r.status !== 201) {
      return { ok: false, ...explicarErro(r.body), status: r.status, xmlDps: assinado };
    }

    const j = JSON.parse(r.body) as { chaveAcesso?: string; nfseXmlGZipB64?: string; idDps?: string };
    if (!j.chaveAcesso || !j.nfseXmlGZipB64) {
      return { ok: false, erro: "A SEFIN respondeu sem chave de acesso.", status: r.status, xmlDps: assinado };
    }
    return {
      ok: true,
      chaveAcesso: j.chaveAcesso,
      idDps: j.idDps ?? id,
      xmlNfse: deGzipB64(j.nfseXmlGZipB64),
      xmlDps: assinado,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: msg, xmlDps: assinado };
  }
}

// Consulta a NFS-e pela chave de acesso (50 dígitos).
export async function consultarNfse(
  chave: string,
  ambiente: AmbienteNFSe,
  cert: Certificado,
): Promise<{ ok: true; xmlNfse: string } | { ok: false; erro: string }> {
  const r = await requisicao(ambiente, "GET", `/SefinNacional/nfse/${chave}`, cert);
  if (r.status !== 200) return { ok: false, ...explicarErro(r.body) };
  const j = JSON.parse(r.body) as { nfseXmlGZipB64?: string };
  if (!j.nfseXmlGZipB64) return { ok: false, erro: "Resposta sem o XML da NFS-e." };
  return { ok: true, xmlNfse: deGzipB64(j.nfseXmlGZipB64) };
}

// Recupera a chave a partir do Id da DPS. Serve para o caso em que a emissão
// deu timeout: a nota pode ter sido gerada mesmo sem a resposta ter chegado, e
// reenviar criaria duplicidade.
export async function consultarPorDps(
  id: string,
  ambiente: AmbienteNFSe,
  cert: Certificado,
): Promise<{ ok: true; chaveAcesso: string } | { ok: false; erro: string }> {
  const r = await requisicao(ambiente, "GET", `/SefinNacional/dps/${id}`, cert);
  if (r.status !== 200) return { ok: false, ...explicarErro(r.body) };
  const j = JSON.parse(r.body) as { chaveAcesso?: string };
  if (!j.chaveAcesso) return { ok: false, erro: "DPS ainda não processada." };
  return { ok: true, chaveAcesso: j.chaveAcesso };
}
