import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@atrium/database";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AuditService } from "./services/audit.service";
import { CreateAgentProjectNoteDto, ListAgentProjectNotesDto, UpdateAgentProjectNoteDto } from "./dto/project-note.dto";
import type { AgentResult } from "./agent-projects.service";

const AGENT_USER_ID = "user-pexlo-agent";

@Injectable()
export class AgentProjectNotesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateAgentProjectNoteDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    if (dto.externalId) {
      const existing = await this.prisma.projectNote.findFirst({ where: { organizationId: apiKey.organizationId, externalId: dto.externalId } });
      if (existing) return { data: existing, auditEventId: null, created: false };
    }
    await this.assertProject(dto.projectId, apiKey.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.projectNote.create({
        data: {
          projectId: dto.projectId,
          organizationId: apiKey.organizationId,
          authorId: AGENT_USER_ID,
          content: dto.body,
          externalId: dto.externalId,
          source: "agent",
        },
      });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "project_note",
        entityId: note.id,
        action: "created",
        before: null,
        after: note,
      });
      return { data: note, auditEventId: event.id, created: true };
    });
  }

  async list(query: ListAgentProjectNotesDto, apiKey: CurrentApiKeyContext) {
    const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
    const where: Prisma.ProjectNoteWhereInput = { organizationId: apiKey.organizationId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.cursor) where.createdAt = { lt: new Date(query.cursor) };
    const items = await this.prisma.projectNote.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
    return { items, nextCursor: items.length === limit ? items[items.length - 1]?.createdAt.toISOString() : null };
  }

  async update(id: string, dto: UpdateAgentProjectNoteDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    const existing = await this.prisma.projectNote.findFirst({ where: { id, organizationId: apiKey.organizationId } });
    if (!existing) throw new NotFoundException("Project note not found");

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.projectNote.update({ where: { id }, data: { ...(dto.body !== undefined ? { content: dto.body } : {}) } });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "project_note",
        entityId: note.id,
        action: "updated",
        before: existing,
        after: note,
      });
      return { data: note, auditEventId: event.id, created: false };
    });
  }

  private async assertProject(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException("Project not found");
  }
}
