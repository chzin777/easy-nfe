import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_SESSAO = "easy-nfe-sessao";
// Públicas que redirecionam pro painel quando já logado (landing/login/cadastro).
const REDIR_SE_LOGADO = ["/", "/login", "/cadastro"];
// Públicas acessíveis por qualquer um (logado ou não), sem redirect: pagamento,
// legais e recuperação de senha (o usuário está deslogado justamente por não
// lembrar a senha).
const PUBLICAS_ABERTAS = ["/pagar", "/termos", "/privacidade", "/recuperar-senha", "/redefinir-senha"];

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

  // Server Actions são POST (header Next-Action). NÃO redirecionar — redirecionar
  // um POST de action quebra com "An unexpected response was received from the
  // server". A própria action faz o controle de acesso (exigir*).
  if (req.method !== "GET" || req.headers.has("next-action")) {
    return NextResponse.next();
  }

  const sessao = await lerSessao(req);
  const autenticado = sessao !== null;
  const casa = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const redirSeLogado = REDIR_SE_LOGADO.some(casa);
  const publica = redirSeLogado || PUBLICAS_ABERTAS.some(casa);

  // Logado vendo landing/login/cadastro → manda pro painel.
  if (redirSeLogado && autenticado) {
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
