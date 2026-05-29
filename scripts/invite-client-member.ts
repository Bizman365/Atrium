#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@atrium/database";

const prisma = new PrismaClient();

type Args = {
  orgSlug?: string;
  email?: string;
  name?: string;
  role: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { role: "member" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    if (!token.startsWith("--")) continue;
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    i += 1;
    if (token === "--org-slug") args.orgSlug = value;
    else if (token === "--email") args.email = value;
    else if (token === "--name") args.name = value;
    else if (token === "--role") args.role = value;
    else throw new Error(`Unknown argument ${token}`);
  }
  return args;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const orgSlug = requireArg(args.orgSlug, "--org-slug");
  const email = requireArg(args.email, "--email").toLowerCase();
  const role = args.role || "member";

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      members: {
        where: { role: { in: ["owner", "admin"] } },
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!organization) throw new Error(`Organization not found for slug "${orgSlug}"`);
  const inviter = organization.members[0];
  if (!inviter) throw new Error(`No owner/admin member found for organization "${organization.name}"`);

  const existingMember = await prisma.member.findFirst({
    where: { organizationId: organization.id, user: { email } },
    include: { user: { select: { email: true, name: true } } },
  });

  if (existingMember) {
    console.log(`Already a member: ${existingMember.user.name || existingMember.user.email}`);
    return;
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: { organizationId: organization.id, email, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const invitation =
    existingInvitation ??
    (await prisma.invitation.create({
      data: {
        id: randomUUID(),
        organizationId: organization.id,
        email,
        role,
        status: "pending",
        inviterId: inviter.userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    }));

  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const invitationUrl = `${webUrl}/accept-invite?id=${invitation.id}`;

  console.log(`Organization: ${organization.name} (${organization.slug})`);
  console.log(`Inviter: ${inviter.user.name} <${inviter.user.email}>`);
  console.log(`Invitee: ${args.name ? `${args.name} <${email}>` : email}`);
  console.log(`Role: ${role}`);
  console.log(`Invitation URL: ${invitationUrl}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
