import { createHash } from "node:crypto";

// QR Code da NFC-e (modelo 65) — versão 2.00, emissão online (NT 2015.003).
//
// SEFAZ-GO. URL de consulta atualizada pelo Informe Técnico 2025.003
// (vigente desde 16/06/2025). Usar URL antiga gera rejeição 395.
const URL_CONSULTA_GO: Record<"1" | "2", string> = {
  "1": "https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe",
  "2": "https://nfewebhomolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe",
};

// Monta o conteúdo do QR Code e a URL de consulta por chave (urlChave), que vão
// no bloco <infNFeSupl>. Online (tpEmis=1): parâmetros chave|versao|tpAmb|cIdToken,
// hash SHA-1 (hex maiúsculo) da concatenação desses parâmetros + CSC.
export function montarQrCode(p: {
  chave: string;
  tpAmb: "1" | "2";
  idCsc: string;
  csc: string;
}): { qrCode: string; urlChave: string } {
  const urlConsulta = URL_CONSULTA_GO[p.tpAmb];
  // cIdToken sem zeros à esquerda (1-6 dígitos), conforme leiaute.
  const cIdToken = String(parseInt(p.idCsc.replace(/\D/g, "") || "0", 10));
  const dados = `${p.chave}|2|${p.tpAmb}|${cIdToken}`;
  const hash = createHash("sha1").update(dados + p.csc).digest("hex").toUpperCase();
  const qrCode = `${urlConsulta}?p=${dados}|${hash}`;
  return { qrCode, urlChave: urlConsulta };
}
