import { Injectable } from "@nestjs/common";
import { Prisma } from "@atrium/database";
import { PrismaService } from "../../prisma/prisma.service";
import type { CurrentApiKeyContext } from "../decorators/current-api-key.decorator";

export interface WriteAuditInput {
  tx?: Prisma.TransactionClient;
  organizationId: string;
  apiKey: CurrentApiKeyContext;
  requestId: string;
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "status_changed" | string;
  before?: unknown | null;
  after?: unknown | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async writeAudit(input: WriteAuditInput) {
    const client = input.tx ?? this.prisma;
    return client.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorType: "api_key",
        actorId: input.apiKey.id,
        source: "agent",
        before: toJson(input.before),
        after: toJson(input.after),
        metadata: {
          apiKeyPrefix: input.apiKey.keyPrefix,
          request_id: input.requestId,
          ...(input.metadata ?? {}),
        },
      },
    });
  }
}

function toJson(value: unknown | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
