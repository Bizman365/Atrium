#!/usr/bin/env bun
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@atrium/database";
import { apiKeyDisplayPrefix, generateRawApiKey, hashApiKey } from "../apps/api/src/agent/services/api-key.service";

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1);
    const quote = val[0];
    if (quote === '"' || quote === "'") {
      const endIdx = val.indexOf(quote, 1);
      val = endIdx !== -1 ? val.slice(1, endIdx) : val.slice(1);
    } else {
      const hashIdx = val.indexOf(" #");
      if (hashIdx !== -1) val = val.slice(0, hashIdx).trim();
    }
    process.env[key] = val;
  }
}

interface Args {
  org?: string;
  name?: string;
  scopes?: string;
  createdBy?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--org") {
      args.org = next;
      i += 1;
    } else if (arg === "--name") {
      args.name = next;
      i += 1;
    } else if (arg === "--scopes") {
      args.scopes = next;
      i += 1;
    } else if (arg === "--created-by") {
      args.createdBy = next;
      i += 1;
    }
  }
  return args;
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env"));
  loadEnv(resolve(process.cwd(), "apps/api/.env"));

  const args = parseArgs(process.argv.slice(2));
  if (!args.org || !args.name || !args.scopes) {
    console.error('Usage: bun run scripts/create-api-key.ts --org <organizationId> --name "Omni Agent" --scopes "projects:write,projects:read"');
    process.exit(1);
  }

  const scopes = args.scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
  if (scopes.length === 0) {
    console.error("At least one scope is required");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUnique({ where: { id: args.org } });
    if (!org) {
      console.error(`Organization not found: ${args.org}`);
      process.exit(1);
    }

    const token = generateRawApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: args.org,
        name: args.name,
        keyHash: hashApiKey(token),
        keyPrefix: apiKeyDisplayPrefix(token),
        scopes,
        createdById: args.createdBy,
      },
    });

    console.log("API key created");
    console.log(`id: ${apiKey.id}`);
    console.log(`name: ${apiKey.name}`);
    console.log(`organizationId: ${apiKey.organizationId}`);
    console.log(`keyPrefix: ${apiKey.keyPrefix}`);
    console.log(`scopes: ${apiKey.scopes.join(",")}`);
    console.log('WARN: raw token shown once; this will not be shown again');
    console.log(token);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
