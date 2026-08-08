import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  saringPrisma?: PrismaClient;
};

export function getPrismaClient() {
  if (globalForPrisma.saringPrisma) return globalForPrisma.saringPrisma;

  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.saringPrisma = client;
  }
  return client;
}
