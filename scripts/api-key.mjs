// Gera / lista / revoga API keys de integração (sem UI).
//
// Uso:
//   npx tsx scripts/api-key.mjs empresas                 → lista empresas (id + nome)
//   npx tsx scripts/api-key.mjs gerar <empresaId> [nome] → cria uma chave e mostra o token
//   npx tsx scripts/api-key.mjs listar <empresaId>       → lista chaves da empresa (sem o token)
//   npx tsx scripts/api-key.mjs revogar <keyId>          → desativa uma chave
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";
import { gerarToken } from "../lib/api-auth.ts";

const [, , cmd, arg1, ...resto] = process.argv;

function fim() { return prisma.$disconnect(); }

if (cmd === "empresas") {
  const empresas = await prisma.emitente.findMany({
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
    orderBy: { razaoSocial: "asc" },
  });
  for (const e of empresas) {
    console.log(`${e.id}  ${e.nomeFantasia || e.razaoSocial} (${e.cnpj})`);
  }
  console.log(`\n${empresas.length} empresa(s).`);
  await fim();
} else if (cmd === "gerar") {
  if (!arg1) { console.error("Informe o empresaId. Rode: npx tsx scripts/api-key.mjs empresas"); await fim(); process.exit(1); }
  const empresa = await prisma.emitente.findUnique({ where: { id: arg1 }, select: { razaoSocial: true, nomeFantasia: true } });
  if (!empresa) { console.error(`Empresa ${arg1} não encontrada.`); await fim(); process.exit(1); }

  const nome = resto.join(" ") || "Integração";
  const { token, prefixo, hash } = gerarToken();
  const key = await prisma.apiKey.create({
    data: { empresaId: arg1, nome, prefixo, tokenHash: hash },
    select: { id: true },
  });

  console.log("\n================= API KEY GERADA =================");
  console.log(`Empresa : ${empresa.nomeFantasia || empresa.razaoSocial}`);
  console.log(`Rótulo  : ${nome}`);
  console.log(`Key ID  : ${key.id}`);
  console.log(`\nTOKEN (copie agora — não será mostrado de novo):\n\n  ${token}\n`);
  console.log("Uso:");
  console.log(`  curl -H "Authorization: Bearer ${token}" https://easynfe-api.digital/v1/produtos`);
  console.log("=================================================\n");
  await fim();
} else if (cmd === "listar") {
  if (!arg1) { console.error("Informe o empresaId."); await fim(); process.exit(1); }
  const keys = await prisma.apiKey.findMany({
    where: { empresaId: arg1 },
    orderBy: { createdAt: "desc" },
    select: { id: true, nome: true, prefixo: true, ultimoUso: true, revogadaEm: true, createdAt: true },
  });
  for (const k of keys) {
    const st = k.revogadaEm ? "REVOGADA" : "ativa";
    const uso = k.ultimoUso ? k.ultimoUso.toISOString() : "nunca usada";
    console.log(`${k.id}  ${k.prefixo}…  [${st}]  ${k.nome}  · últ. uso: ${uso}`);
  }
  console.log(`\n${keys.length} chave(s).`);
  await fim();
} else if (cmd === "revogar") {
  if (!arg1) { console.error("Informe o keyId."); await fim(); process.exit(1); }
  await prisma.apiKey.update({ where: { id: arg1 }, data: { revogadaEm: new Date() } });
  console.log(`Chave ${arg1} revogada.`);
  await fim();
} else {
  console.log("Comandos: empresas | gerar <empresaId> [nome] | listar <empresaId> | revogar <keyId>");
  await fim();
}
