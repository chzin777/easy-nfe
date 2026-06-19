import pg from "pg";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 usa driver adapters — a conexão vem do PrismaPg (lê DATABASE_URL do .env).
// Singleton p/ não esgotar conexões com o hot-reload do Next em dev.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

function criarPool(): pg.Pool {
  // Em serverless (Vercel) cada instância abre seu próprio pool. Usamos a connection
  // string POOLED do Neon (-pooler / PgBouncer). Mantém poucas conexões por instância e
  // libera ociosas rápido para não estourar o limite de conexões.
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    allowExitOnIdle: true,
  });
  // O Neon/PgBouncer encerra conexões ociosas no servidor. Sem este handler, o erro
  // do client ocioso ("Connection terminated unexpectedly") sobe como exceção não
  // tratada e derruba a request. Aqui só registramos — o pool descarta a conexão
  // morta e abre outra na próxima query.
  pool.on("error", (e) => {
    console.warn("pg pool: conexão ociosa caiu (descartada)", e.message);
  });
  return pool;
}

function criar(): PrismaClient {
  const pool = globalForPrisma.pgPool ?? criarPool();
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? criar();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const ERRO_CONEXAO = /Connection terminated|terminated unexpectedly|ECONNRESET|Connection ended|server closed/i;

// Reexecuta uma leitura quando a 1ª tentativa pega uma conexão ociosa que o Neon
// acabou de encerrar. Use só em operações idempotentes (leituras).
export async function comRetry<T>(fn: () => Promise<T>, tentativas = 2): Promise<T> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!ERRO_CONEXAO.test(msg)) throw e;
    }
  }
  throw ultimoErro;
}
