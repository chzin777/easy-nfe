// Cria o admin inicial e dá acesso (dono) às empresas órfãs.
// Uso: npx tsx scripts/seed-admin.mjs
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";

const EMAIL = "admin@easy.com";
const SENHA = "easy123123";

const admin = await prisma.user.upsert({
  where: { email: EMAIL },
  update: { role: "ADMIN", ativo: true },
  create: { email: EMAIL, senhaHash: await bcrypt.hash(SENHA, 10), nome: "Administrador", role: "ADMIN" },
});
console.log("admin pronto:", admin.email, "role:", admin.role);

// Backfill: toda empresa precisa de um AcessoEmpresa(dono) p/ o criador.
const empresas = await prisma.emitente.findMany({ select: { id: true, userId: true } });
let criados = 0;
for (const e of empresas) {
  const existe = await prisma.acessoEmpresa.findUnique({
    where: { userId_empresaId: { userId: e.userId, empresaId: e.id } },
  });
  if (!existe) {
    await prisma.acessoEmpresa.create({ data: { userId: e.userId, empresaId: e.id, papel: "dono" } });
    criados++;
  }
}
console.log("acessos(dono) criados p/ empresas órfãs:", criados);

await prisma.$disconnect();
