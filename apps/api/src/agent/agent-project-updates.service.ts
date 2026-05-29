import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@atrium/database";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AuditService } from "./services/audit.service";
import { CreateAgentProjectUpdateDto, ListAgentProjectUpdatesDto, UpdateAgentProjectUpdateDto } from "./dto/project-update.dto";
import type { AgentResult } from "./agent-projects.service";

const AGENT_USER_ID = "user-pexlo-agent";

@Injectable()
export class AgentProjectUpdatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateAgentProjectUpdateDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    if (dto.externalId) {
      const existing = await this.prisma.projectUpdate.findFirst({ where: { organizationId: apiKey.organizationId, externalId: dto.externalId } });
      if (existing) return { data: existing, auditEventId: null, created: false };
    }
    await this.assertProject(dto.projectId, apiKey.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.projectUpdate.create({
        data: {
          projectId: dto.projectId,
          organizationId: apiKey.organizationId,
          authorId: AGENT_USER_ID,
          title: dto.title,
          content: dto.body,
          externalId: dto.externalId,
          source: "agent",
          clientVisible: dto.clientVisible ?? true,
        },
      });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "project_update",
        entityId: update.id,
        action: "created",
        before: null,
        after: update,
      });
      return { data: update, auditEventId: event.id, created: true };
    });
  }

  async list(query: ListAgentProjectUpdatesDto, apiKey: CurrentApiKeyContext) {
    const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
    const where: Prisma.ProjectUpdateWhereInput = { organizationId: apiKey.organizationId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.cursor) where.createdAt = { lt: new Date(query.cursor) };
    const items = await this.prisma.projectUpdate.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
    return { items, nextCursor: items.length === limit ? items[items.length - 1]?.createdAt.toISOString() : null };
  }

  async update(id: string, dto: UpdateAgentProjectUpdateDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    const existing = await this.prisma.projectUpdate.findFirst({ where: { id, organizationId: apiKey.organizationId } });
    if (!existing) throw new NotFoundException("Project update not found");

    return this.prisma.$transaction(async (tx) => {
      const update = await tx.projectUpdate.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.body !== undefined ? { content: dto.body } : {}),
          ...(dto.clientVisible !== undefined ? { clientVisible: dto.clientVisible } : {}),
        },
      });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "project_update",
        entityId: update.id,
        action: "updated",
        before: existing,
        after: update,
      });
      return { data: update, auditEventId: event.id, created: false };
    });
  }

  private async assertProject(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException("Project not found");
  }
}
