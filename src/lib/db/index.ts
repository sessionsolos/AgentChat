/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload creates new module instances, which
 * would exhaust the connection pool with a naive `new PrismaClient()` in
 * every request. This pattern stores the client on `globalThis` so only
 * one instance exists across hot reloads.
 *
 * In production, module instances are stable so the singleton is a no-op.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
