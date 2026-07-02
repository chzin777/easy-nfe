import "server-only";
import { headers } from "next/headers";

// Base pública do app (sem barra no fim). Usa APP_URL quando definido; senão
// deduz do host da requisição. Serve p/ montar links absolutos em e-mails.
export async function baseUrlServidor(): Promise<string> {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
