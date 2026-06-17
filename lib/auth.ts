import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_SESSAO = "easy-nfe-sessao";
const COOKIE_EMPRESA = "easy-nfe-empresa";
const DIAS = 7;

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não configurado.");
  return new TextEncoder().encode(s);
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// Cria a sessão (JWT assinado HS256) e grava em cookie httpOnly.
export async function criarSessao(userId: string, role: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(segredo());

  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 3600,
  });
}

// Lê o userId da sessão atual (ou null se ausente/inválida).
export async function lerSessao(): Promise<string | null> {
  return (await lerSessaoCompleta())?.uid ?? null;
}

// Sessão completa (uid + role).
export async function lerSessaoCompleta(): Promise<{ uid: string; role: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, role: typeof payload.role === "string" ? payload.role : "USER" };
  } catch {
    return null;
  }
}

export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_EMPRESA);
}

// Empresa ativa — guardada em cookie (não-httpOnly não é necessário; só id).
export async function definirEmpresaAtiva(empresaId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_EMPRESA, empresaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 3600,
  });
}

export async function lerEmpresaAtiva(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_EMPRESA)?.value ?? null;
}
