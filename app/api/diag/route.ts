import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DIAGNÓSTICO TEMPORÁRIO — remover depois.
export async function GET() {
  const out: Record<string, unknown> = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "desconhecido",
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    nodeVersion: process.version,
  };

  // Simula o caminho do login (sem setar cookie).
  try {
    const { prisma } = await import("@/lib/prisma");
    const bcrypt = (await import("bcryptjs")).default;
    const { SignJWT } = await import("jose");

    const user = await prisma.user.findUnique({ where: { email: "admin@easy.com" } });
    out.adminEncontrado = !!user;
    if (user) {
      out.senhaConfere = await bcrypt.compare("easy123123", user.senhaHash);
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
      await new SignJWT({ uid: user.id, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
      out.jwtAssinou = true;
      // aposLogin (admin → primeira empresa)
      const emp = await prisma.emitente.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      out.temEmpresa = !!emp;
    }
    out.fluxo = "ok";
  } catch (e) {
    out.fluxo = "ERRO: " + (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }

  return NextResponse.json(out);
}
