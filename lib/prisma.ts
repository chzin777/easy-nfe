import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 usa driver adapters — a conexão vem do PrismaPg (lê DATABASE_URL do .env).
// Singleton p/ não esgotar conexões com o hot-reload do Next em dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criar(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? criar();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
