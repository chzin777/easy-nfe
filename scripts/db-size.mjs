// Mostra tamanho do banco Neon + por tabela. Uso: npx tsx scripts/db-size.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

const total = await prisma.$queryRawUnsafe(
  `SELECT pg_database_size(current_database()) AS bytes, pg_size_pretty(pg_database_size(current_database())) AS pretty`,
);
console.log(`\nBanco total: ${total[0].pretty} (${Number(total[0].bytes).toLocaleString("pt-BR")} bytes)\n`);

const tabelas = await prisma.$queryRawUnsafe(`
  SELECT c.relname AS tabela,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS tamanho,
         pg_total_relation_size(c.oid) AS bytes,
         n_live_tup AS linhas
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  ORDER BY pg_total_relation_size(c.oid) DESC
`);

console.log("Por tabela:");
for (const t of tabelas) {
  console.log(`  ${String(t.tamanho).padStart(9)}  ${String(t.linhas ?? 0).padStart(7)} linhas  ${t.tabela}`);
}
await prisma.$disconnect();
