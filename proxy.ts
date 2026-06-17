import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_SESSAO = "easy-nfe-sessao";
// Rotas públicas (sem sessão): landing e login.
const PUBLICAS = ["/", "/login", "/api/diag"];

async function lerSessao(req: NextRequest): Promise<{ role: string } | null> {
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { role: typeof payload.role === "string" ? payload.role : "USER" };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessao = await lerSessao(req);
  const autenticado = sessao !== null;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Logado vendo landing/login → manda pro painel.
  if (publica && autenticado) {
    return NextResponse.redirect(new URL("/painel", req.url));
  }
  // Não logado em rota protegida → manda pra landing.
  if (!publica && !autenticado) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  // Painel admin: só ADMIN/SUPORTE.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (sessao!.role !== "ADMIN" && sessao!.role !== "SUPORTE") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  // Aplica a tudo, exceto assets internos do Next e arquivos estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
