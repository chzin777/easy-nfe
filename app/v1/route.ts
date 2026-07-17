import { NextResponse } from "next/server";
import { autenticarApiKey } from "@/lib/api-auth";

// GET /v1 — sanity check / autenticação. Confirma que a API key é válida.
export async function GET(req: Request) {
  const empresaId = await autenticarApiKey(req);
  if (!empresaId) {
    return NextResponse.json(
      { erro: "API key inválida ou ausente. Envie no header Authorization: Bearer <token> ou x-api-key: <token>." },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, versao: "v1", empresaId });
}
