import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DIAGNÓSTICO TEMPORÁRIO — remover depois.
export async function GET() {
  const out: Record<string, unknown> = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    dbHost: (process.env.DATABASE_URL || "").replace(/^.*@/, "").split("/")[0] || null,
    nodeVersion: process.version,
  };
  try {
    const { prisma } = await import("@/lib/prisma");
    out.userCount = await prisma.user.count();
    out.prisma = "ok";
  } catch (e) {
    out.prisma = "ERRO: " + (e instanceof Error ? e.message : String(e));
  }
  try {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await new SignJWT({ t: 1 }).setProtectedHeader({ alg: "HS256" }).sign(secret);
    out.jwt = "ok";
  } catch (e) {
    out.jwt = "ERRO: " + (e instanceof Error ? e.message : String(e));
  }
  return NextResponse.json(out);
}
