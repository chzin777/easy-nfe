// Cria o benefício especial oculto "tudo_anterior". Uso: npx tsx scripts/seed-beneficio-anterior.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

await prisma.beneficio.upsert({
  where: { chave: "tudo_anterior" },
  update: { nome: "Tudo do plano anterior", oculto: true, ativo: true, ordem: 0 },
  create: { chave: "tudo_anterior", nome: "Tudo do plano anterior", oculto: true, ativo: true, ordem: 0 },
});
console.log("benefício 'tudo_anterior' pronto (oculto)");
await prisma.$disconnect();
