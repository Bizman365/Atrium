import { Injectable } from "@nestjs/common";
import type { Prisma } from "@atrium/database";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { ListAgentAuditDto } from "./dto/list-audit.dto";

@Injectable()
export class AgentAuditService {
  constructor(private prisma: PrismaService) {}

  async list(query: ListAgentAuditDto, apiKey: CurrentApiKeyContext) {
    const limit = Math.min(query.limit ?? 100, 500);
    const where: Prisma.AuditEventWhereInput = { organizationId: apiKey.organizationId };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorType) where.actorType = query.actorType;
    if (query.actorId) where.actorId = query.actorId;
    if (query.since || query.cursor) {
      where.createdAt = {
        ...(query.since ? { gte: new Date(query.since) } : {}),
        ...(query.cursor ? { lt: new Date(query.cursor) } : {}),
      };
    }

    const items = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1]?.createdAt.toISOString() : null,
    };
  }
}
