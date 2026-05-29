import { PrismaClient } from "@atrium/database";

const globalForPrisma = globalThis as unknown as {
  atriumPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.atriumPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.atriumPrisma = prisma;
}
