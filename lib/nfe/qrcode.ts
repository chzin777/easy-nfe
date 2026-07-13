import { createHash } from "node:crypto";
import { urlsQrCode, type TpAmb } from "./ufs";

// QR Code da NFC-e (modelo 65) — versão 2.00, emissão online (NT 2015.003).
//
// Monta o conteúdo do QR Code e a URL de consulta por chave (urlChave), que vão
// no bloco <infNFeSupl>. Online (tpEmis=1): parâmetros chave|versao|tpAmb|cIdToken,
// hash SHA-1 (hex maiúsculo) da concatenação desses parâmetros + CSC.
//
// urlQrCode e urlChave são valores distintos e a SEFAZ valida os dois (rejeição
// 395 / 878 se divergirem) — ambos saem do registry por UF em ./ufs.
export function montarQrCode(p: {
  chave: string;
  uf: string;
  tpAmb: TpAmb;
  idCsc: string;
  csc: string;
}): { qrCode: string; urlChave: string } {
  const { urlQrCode, urlChave } = urlsQrCode(p.uf, p.tpAmb);
  // cIdToken sem zeros à esquerda (1-6 dígitos), conforme leiaute.
  const cIdToken = String(parseInt(p.idCsc.replace(/\D/g, "") || "0", 10));
  const dados = `${p.chave}|2|${p.tpAmb}|${cIdToken}`;
  const hash = createHash("sha1").update(dados + p.csc).digest("hex").toUpperCase();
  return { qrCode: `${urlQrCode}?p=${dados}|${hash}`, urlChave };
}
