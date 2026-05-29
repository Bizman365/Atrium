import { PrismaClient } from "../packages/database/src";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "agent@pexlo.local" } });
  if (existing) {
    console.log("Agent user exists:", existing.id);
    return;
  }

  const user = await prisma.user.create({
    data: {
      id: "user-pexlo-agent",
      email: "agent@pexlo.local",
      name: "Pexlo Agent",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log("Created agent user:", user.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
