// Cria o benefício "multiempresa" e vincula a Profissional/Empresarial. Uso: npx tsx scripts/seed-multiempresa.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

const b = await prisma.beneficio.upsert({
  where: { chave: "multiempresa" },
  update: { nome: "Vários CNPJs (multiempresa)", features: ["multiempresa"], ativo: true },
  create: { chave: "multiempresa", nome: "Vários CNPJs (multiempresa)", features: ["multiempresa"], ordem: 15, ativo: true },
});

for (const nome of ["Profissional", "Empresarial"]) {
  const p = await prisma.plano.findFirst({ where: { nome } });
  if (p) {
    await prisma.plano.update({ where: { id: p.id }, data: { beneficios: { connect: { id: b.id } } } });
    console.log("vinculado a", nome);
  }
}
await prisma.$disconnect();
