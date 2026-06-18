import https from "node:https";
import { constants } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { Certificado } from "./cert";
import { dataHoraBrasilia } from "./chave";
import { assinar } from "./sign";

// Distribuição DFe — Ambiente Nacional (puxa documentos emitidos contra o CNPJ).
// Hosts homologação antigos (hom.nfe) foram desativados em 23/05/22 → hom1.nfe.
const ENDPOINT = {
  "1": "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  "2": "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
} as const;
const WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

// Recepção de Evento — Ambiente Nacional (manifestação do destinatário, cOrgao 91).
// Produção usa www.nfe (sem o "1"); homologação usa hom1.nfe.
const ENDPOINT_EVENTO = {
  "1": "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
  "2": "https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
} as const;
const WSDL_NS_EVENTO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4";

export type DocDFe = { nsu: string; schema: string; xml: string };
export type ResultadoDFe = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  ultNSU: string;
  maxNSU: string;
  docs: DocDFe[];
};

function extrai(body: string, tag: string): string | null {
  const m = body.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return m ? m[1].trim() : null;
}

// POST SOAP 1.2 via mTLS para um endpoint do Ambiente Nacional. `operacao` é a
// tag-operação do WSDL (nfeDistDFeInteresse / nfeRecepcaoEvento) que envolve o nfeDadosMsg.
function soapAN(
  url: string,
  wsdlNs: string,
  operacao: string,
  inner: string,
  cert: Certificado,
): Promise<{ status: number; body: string }> {
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap:Body><${operacao} xmlns="${wsdlNs}"><nfeDadosMsg>${inner}</nfeDadosMsg></${operacao}></soap:Body>` +
    `</soap:Envelope>`;
  // Transporte idêntico ao da emissão (GO), que funciona: SOAP 1.2 sem header
  // SOAPAction (em SOAP 1.2 o action vai no Content-Type, não em header próprio —
  // o header extra faz o IIS da SEFAZ responder 403).
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname, port: 443, path: u.pathname, method: "POST",
        key: cert.keyPem, cert: cert.chainPem, rejectUnauthorized: false,
        servername: u.hostname, minVersion: "TLSv1.2", maxVersion: "TLSv1.2",
        // O IIS do Ambiente Nacional pede o client-cert via RENEGOCIAÇÃO (não no
        // handshake inicial). Node 24/OpenSSL 3 bloqueia renegociação legada por
        // padrão → cert não é apresentado → HTTP 403. Habilita a renegociação legada.
        secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(envelope),
          "User-Agent": "easy-nfe/1.0",
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          // Sub-status IIS (ex.: "403.7") ajuda a diagnosticar quando falha.
          const h = res.headers;
          const diag = `${h["x-aspnet-version"] ?? ""} ${h["www-authenticate"] ?? ""}`.trim();
          resolve({ status: res.statusCode ?? 0, body: diag ? `[${diag}] ${d}` : d });
        });
      },
    );
    req.on("error", reject);
    req.write(envelope);
    req.end();
  });
}

function soap(tpAmb: "1" | "2", inner: string, cert: Certificado): Promise<{ status: number; body: string }> {
  return soapAN(ENDPOINT[tpAmb], WSDL_NS, "nfeDistDFeInteresse", inner, cert);
}

// Resume um corpo bruto (fault SOAP / HTML de erro) numa linha curta p/ diagnóstico.
function resumoCru(body: string): string {
  const fault =
    extrai(body, "faultstring") ?? extrai(body, "Text") ?? extrai(body, "Reason");
  if (fault) return fault;
  const txt = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return txt.slice(0, 200) || "resposta vazia";
}

// Consulta documentos a partir do último NSU conhecido (lote de até 50 por chamada).
export async function consultarDFe(
  cert: Certificado,
  params: { tpAmb: "1" | "2"; cUF: string; cnpj: string; ultNSU: string },
): Promise<ResultadoDFe> {
  const cnpj = params.cnpj.replace(/\D/g, "");
  const nsu = (params.ultNSU || "0").padStart(15, "0");
  const inner =
    `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${params.tpAmb}</tpAmb><cUFAutor>${params.cUF}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>${nsu}</ultNSU></distNSU></distDFeInt>`;

  const { status, body } = await soap(params.tpAmb, inner, cert);
  const cStat = extrai(body, "cStat");
  // Sem cStat = não chegou ao serviço (SOAP fault / HTTP de erro). Surfaça o motivo bruto.
  const xMotivo =
    extrai(body, "xMotivo") ?? (cStat ? null : `HTTP ${status}: ${resumoCru(body)}`);
  const ultNSU = extrai(body, "ultNSU") ?? nsu;
  const maxNSU = extrai(body, "maxNSU") ?? ultNSU;

  const docs: DocDFe[] = [];
  const re = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]*)"[^>]*>([\s\S]*?)<\/docZip>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    try {
      const xml = gunzipSync(Buffer.from(m[3].trim(), "base64")).toString("utf8");
      docs.push({ nsu: m[1], schema: m[2], xml });
    } catch {
      /* doc corrompido — ignora */
    }
  }

  // 138 = documentos localizados, 137 = nenhum documento novo.
  return { ok: cStat === "138" || cStat === "137", cStat, xMotivo, ultNSU, maxNSU, docs };
}

// ----------------------------------------------------------------------------
// Manifestação do destinatário (eventos 2102xx) — Ambiente Nacional, cOrgao 91.
// ----------------------------------------------------------------------------
export type TipoManifesto = "210200" | "210210" | "210220" | "210240";

const DESC_MANIFESTO: Record<TipoManifesto, string> = {
  "210200": "Confirmacao da Operacao",
  "210210": "Ciencia da Operacao",
  "210220": "Desconhecimento da Operacao",
  "210240": "Operacao nao Realizada",
};

export type ResultadoManifesto = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  nProt: string | null;
};

// Envia a manifestação do destinatário sobre uma NF-e (chave de 44 dígitos).
// 210240 (Operação não Realizada) exige justificativa de 15 a 255 caracteres.
export async function manifestarDestinatario(
  cert: Certificado,
  params: {
    tpAmb: "1" | "2";
    cnpj: string;
    chave: string;
    tipo: TipoManifesto;
    justificativa?: string;
  },
): Promise<ResultadoManifesto> {
  const cnpj = params.cnpj.replace(/\D/g, "");
  const dh = dataHoraBrasilia();
  const nSeq = "1";
  const idEvento = `ID${params.tipo}${params.chave}${nSeq.padStart(2, "0")}`;

  const xJust =
    params.tipo === "210240"
      ? `<xJust>${(params.justificativa ?? "").replace(/[<>&]/g, " ")}</xJust>`
      : "";

  const infEvento =
    `<infEvento Id="${idEvento}">` +
    `<cOrgao>91</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${params.chave}</chNFe><dhEvento>${dh}</dhEvento><tpEvento>${params.tipo}</tpEvento>` +
    `<nSeqEvento>${nSeq}</nSeqEvento><verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>${DESC_MANIFESTO[params.tipo]}</descEvento>${xJust}</detEvento>` +
    `</infEvento>`;
  const evento = `<evento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">${infEvento}</evento>`;
  const eventoAssinado = assinar(evento, idEvento, cert, "infEvento");
  const envEvento =
    `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>1</idLote>${eventoAssinado}</envEvento>`;

  const { status, body } = await soapAN(ENDPOINT_EVENTO[params.tpAmb], WSDL_NS_EVENTO, "nfeRecepcaoEvento", envEvento, cert);

  // O retorno traz o status do lote e, dentro de retEvento, o status do evento.
  const retEvento = body.match(/<retEvento[\s\S]*?<\/retEvento>/)?.[0] ?? body;
  const cStat = extrai(retEvento, "cStat");
  const xMotivo =
    extrai(retEvento, "xMotivo") ?? (cStat ? null : `HTTP ${status}: ${resumoCru(body)}`);
  const nProt = extrai(retEvento, "nProt");
  // 135 = registrado e vinculado, 136 = registrado (não vinculado — nota ainda não na base).
  return { ok: cStat === "135" || cStat === "136", cStat, xMotivo, nProt };
}
