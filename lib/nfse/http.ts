import https from "node:https";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Certificado } from "@/lib/nfe/cert";

// Transporte comum dos serviços da NFS-e Padrão Nacional.
//
// Tanto a SEFIN Nacional (emissão) quanto o ADN (distribuição) usam TLS 1.2+
// com autenticação mútua: o certificado A1 da empresa é a credencial, não há
// token nem OAuth. Os XMLs trafegam em GZip + Base64.

export const gzipB64 = (xml: string) => gzipSync(Buffer.from(xml, "utf8")).toString("base64");
export const deGzipB64 = (b64: string) => gunzipSync(Buffer.from(b64, "base64")).toString("utf8");

export type Resposta = { status: number; body: string };

export function requisicao(
  host: string,
  metodo: "GET" | "POST",
  caminho: string,
  cert: Certificado,
  corpo?: string,
): Promise<Resposta> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path: caminho,
        method: metodo,
        key: cert.keyPem,
        cert: cert.chainPem, // folha + cadeia no handshake, igual à NF-e
        minVersion: "TLSv1.2",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(corpo ? { "Content-Length": Buffer.byteLength(corpo) } : {}),
        },
        timeout: 60_000,
      },
      (res) => {
        let dados = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { dados += c; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: dados }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Tempo esgotado ao falar com ${host}.`)));
    req.on("error", reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

// Extrai a mensagem de erro do corpo devolvido pelo fisco. O formato varia
// entre rejeição de schema e rejeição de regra, então tentamos os campos
// conhecidos antes de cair no corpo cru.
export function explicarErro(body: string): { erro: string; mensagens?: { codigo?: string; descricao?: string }[] } {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const lista = (j.erros ?? j.Erros ?? j.mensagens) as { Codigo?: string; codigo?: string; Descricao?: string; descricao?: string; Complemento?: string }[] | undefined;
    if (Array.isArray(lista) && lista.length) {
      const mensagens = lista.map((m) => ({
        codigo: m.Codigo ?? m.codigo,
        descricao: [m.Descricao ?? m.descricao, m.Complemento].filter(Boolean).join(" — "),
      }));
      return { erro: mensagens.map((m) => `${m.codigo ?? ""} ${m.descricao ?? ""}`.trim()).join("; "), mensagens };
    }
    const msg = j.message ?? j.Message ?? j.erro;
    if (typeof msg === "string") return { erro: msg };
  } catch {
    // corpo não-JSON: devolve cru, truncado
  }
  return { erro: body.slice(0, 500) || "Resposta vazia do serviço." };
}
