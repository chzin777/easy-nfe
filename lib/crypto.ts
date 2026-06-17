import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Chave AES-256 derivada do segredo do ambiente.
function chave(): Buffer {
  const s = process.env.CERT_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("CERT_SECRET/SESSION_SECRET não configurado.");
  return createHash("sha256").update(s).digest(); // 32 bytes
}

// Criptografa texto (ex.: JSON com pfx+senha) → base64 (iv | tag | ciphertext).
export function encriptar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// Descriptografa o que encriptar() produziu.
export function decriptar(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
