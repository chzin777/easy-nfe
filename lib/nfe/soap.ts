import https from "node:https";
import type { Certificado } from "./cert";
import { endpoint, type Destino, type Servico } from "./ufs";

export type { Destino, Servico };

const WSDL_NS: Record<Servico, string> = {
  status: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4",
  autoriza: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4",
  retAutoriza: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4",
  evento: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4",
  consulta: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4",
};

// Operação do WSDL. SOAP 1.2 dispensa o header SOAPAction, mas as autorizadoras
// em Apache Axis (PE) devolvem "no SOAPAction header!" sem ele. Os demais
// webservices ignoram o header — por isso vai sempre.
const OPERACAO: Record<Servico, string> = {
  status: "nfeStatusServicoNF",
  autoriza: "nfeAutorizacaoLote",
  retAutoriza: "nfeRetAutorizacaoLote",
  evento: "nfeRecepcaoEvento",
  consulta: "nfeConsultaNF",
};

// POST SOAP 1.2 via mTLS (key/cert PEM). O destino (UF + modelo + ambiente +
// tpEmis) resolve a autorizadora e a URL. Devolve o corpo bruto da resposta.
export function soap(
  destino: Destino,
  servico: Servico,
  innerXml: string,
  cert: Certificado,
): Promise<{ status: number; body: string }> {
  const url = endpoint(destino, servico);
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
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: "POST",
        key: cert.keyPem,
        cert: cert.chainPem, // envia folha + cadeia no handshake mTLS
        rejectUnauthorized: false, // cadeias da SEFAZ homologação são problemáticas
        timeout: 30_000, // webservices da SEFAZ ficam instáveis; não trava a request
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          SOAPAction: `${WSDL_NS[servico]}/${OPERACAO[servico]}`,
          "Content-Length": Buffer.byteLength(envelope),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    // Timeout de conexão/resposta: aborta e devolve erro claro de indisponibilidade.
    req.on("timeout", () => {
      req.destroy(new Error("SEFAZ_INDISPONIVEL: o serviço da SEFAZ não respondeu a tempo."));
    });
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
