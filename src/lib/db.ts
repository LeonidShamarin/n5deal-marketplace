import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads modules in development, which would otherwise open a new
// pool on every edit until Postgres refuses connections. Keep one client on the
// global object; in production the module is evaluated once anyway.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
