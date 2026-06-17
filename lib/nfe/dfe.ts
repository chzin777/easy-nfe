import https from "node:https";
import { gunzipSync } from "node:zlib";
import type { Certificado } from "./cert";

// Distribuição DFe — Ambiente Nacional (puxa documentos emitidos contra o CNPJ).
const ENDPOINT = {
  "1": "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  "2": "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
} as const;
const WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

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

function soap(tpAmb: "1" | "2", inner: string, cert: Certificado): Promise<string> {
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap:Body><nfeDistDFeInteresse xmlns="${WSDL_NS}"><nfeDadosMsg>${inner}</nfeDadosMsg></nfeDistDFeInteresse></soap:Body>` +
    `</soap:Envelope>`;
  const u = new URL(ENDPOINT[tpAmb]);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname, port: 443, path: u.pathname, method: "POST",
        key: cert.keyPem, cert: cert.certPem, rejectUnauthorized: false,
        servername: u.hostname, minVersion: "TLSv1.2",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(envelope),
          "User-Agent": "easy-nfe/1.0",
        },
      },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(d)); },
    );
    req.on("error", reject);
    req.write(envelope);
    req.end();
  });
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

  const body = await soap(params.tpAmb, inner, cert);
  const cStat = extrai(body, "cStat");
  const xMotivo = extrai(body, "xMotivo");
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
