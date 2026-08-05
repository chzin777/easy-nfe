import { processarContratosVencidos } from "@/lib/contratos";

// Robô dos contratos recorrentes. Roda uma vez por dia (cron da Vercel, ver
// vercel.json) e emite as NFS-e cujo dia chegou.
//
// A Vercel manda "Authorization: Bearer $CRON_SECRET". Sem o segredo
// configurado o endpoint fica fechado — ninguém emite nota por acidente.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return new Response("cron secret não configurado", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const r = await processarContratosVencidos();
  return Response.json(r);
}
