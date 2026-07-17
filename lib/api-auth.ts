import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

// Prefixo do token — "live" deixa claro que é produção. O token bruto nunca é
// guardado; só o hash. Formato: enfe_live_<48 hex>.
const PREFIXO = "enfe_live_";

export type TokenGerado = { token: string; prefixo: string; hash: string };

// Gera um novo token aleatório (alta entropia) e devolve o valor bruto + hash.
// O bruto é mostrado UMA vez (na geração); só o hash vai pro banco.
export function gerarToken(): TokenGerado {
  const token = PREFIXO + randomBytes(24).toString("hex");
  return { token, prefixo: token.slice(0, 16), hash: hashToken(token) };
}

// SHA-256 do token (hex). Determinístico — usado na geração e na verificação.
export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

// Extrai o token de `Authorization: Bearer <token>` ou do header `x-api-key`.
export function extrairToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const x = req.headers.get("x-api-key");
  return x ? x.trim() : null;
}

// Autentica a requisição pela API key. Retorna o empresaId da chave ou null.
// Marca o último uso em background (não bloqueia a resposta).
export async function autenticarApiKey(req: Request): Promise<string | null> {
  const token = extrairToken(req);
  if (!token) return null;
  const key = await prisma.apiKey.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!key || key.revogadaEm) return null;
  void prisma.apiKey.update({ where: { id: key.id }, data: { ultimoUso: new Date() } }).catch(() => {});
  return key.empresaId;
}
