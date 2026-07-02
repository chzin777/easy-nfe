import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Lê a logo (wordmark) do /public e devolve em base64 (PNG). Cacheia em memória
// — o arquivo não muda em runtime. Usada como anexo inline (cid) nos e-mails e
// como imagem no PDF gerado no servidor.
let cache: string | null = null;

export async function logoBase64(): Promise<string> {
  if (cache) return cache;
  const p = path.join(process.cwd(), "public", "images", "logo", "logo-completa.png");
  cache = (await readFile(p)).toString("base64");
  return cache;
}

export const LOGO_CID = "logo-easynfe";
