import https from "node:https";
import type { Certificado } from "./cert";

export type Servico = "status" | "autoriza" | "evento";

// Webservices da SEFAZ-GO (autorizadora própria). Outras UFs exigem outros endpoints.
const ENDPOINTS: Record<"1" | "2", Record<Servico, string>> = {
  // Produção
  "1": {
    status: "https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
    autoriza: "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
    evento: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4",
  },
  // Homologação
  "2": {
    status: "https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
    autoriza: "https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
    evento: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4",
  },
};

const WSDL_NS: Record<Servico, string> = {
  status: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4",
  autoriza: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4",
  evento: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4",
};

export function endpoint(tpAmb: "1" | "2", servico: Servico): string {
  return ENDPOINTS[tpAmb][servico];
}

// POST SOAP 1.2 via mTLS (key/cert PEM). Devolve corpo bruto da resposta.
export function soap(
  tpAmb: "1" | "2",
  servico: Servico,
  innerXml: string,
  cert: Certificado,
): Promise<{ status: number; body: string }> {
  const url = endpoint(tpAmb, servico);
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap:Body><nfeDadosMsg xmlns="${WSDL_NS[servico]}">${innerXml}</nfeDadosMsg></soap:Body>` +
    `</soap:Envelope>`;

  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: "POST",
        key: cert.keyPem,
        cert: cert.certPem,
        rejectUnauthorized: false, // cadeias da SEFAZ homologação são problemáticas
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(envelope),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.write(envelope);
    req.end();
  });
}

// Extrai o conteúdo da primeira ocorrência de uma tag (ignorando namespace prefix).
export function extrai(body: string, tag: string): string | null {
  const m = body.match(
    new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`),
  );
  return m ? m[1].trim() : null;
}

// Extrai um bloco inteiro (com as tags), p/ isolar protNFe / retEvento.
export function extraiBloco(body: string, tag: string): string | null {
  const m = body.match(
    new RegExp(`<(?:\\w+:)?${tag}[\\s\\S]*?</(?:\\w+:)?${tag}>`),
  );
  return m ? m[0] : null;
}
