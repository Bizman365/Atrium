import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@atrium/database";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AuditService } from "./services/audit.service";
import { CreateAgentCommentDto, ListAgentCommentsDto, UpdateAgentCommentDto } from "./dto/comment.dto";
import type { AgentResult } from "./agent-projects.service";

const AGENT_USER_ID = "user-pexlo-agent";

@Injectable()
export class AgentCommentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateAgentCommentDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    this.assertSingleTarget(dto.taskId, dto.projectId);

    if (dto.externalId) {
      const existing = await this.prisma.comment.findFirst({
        where: { organizationId: apiKey.organizationId, externalId: dto.externalId },
      });
      if (existing) return { data: existing, auditEventId: null, created: false };
    }

    if (dto.taskId) await this.assertTask(dto.taskId, apiKey.organizationId);
    if (dto.projectId) await this.assertProject(dto.projectId, apiKey.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          taskId: dto.taskId,
          projectId: dto.projectId,
          organizationId: apiKey.organizationId,
          content: dto.body,
          authorId: AGENT_USER_ID,
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
        entityType: "comment",
        entityId: comment.id,
        action: "created",
        before: null,
        after: comment,
      });
      return { data: comment, auditEventId: event.id, created: true };
    });
  }

  async list(query: ListAgentCommentsDto, apiKey: CurrentApiKeyContext) {
    if (query.taskId && query.projectId) throw new BadRequestException("Filter by taskId or projectId, not both");
    const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
    const where: Prisma.CommentWhereInput = { organizationId: apiKey.organizationId };
    if (query.taskId) where.taskId = query.taskId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.cursor) where.createdAt = { lt: new Date(query.cursor) };

    const items = await this.prisma.comment.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
    return { items, nextCursor: items.length === limit ? items[items.length - 1]?.createdAt.toISOString() : null };
  }

  async update(id: string, dto: UpdateAgentCommentDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    const existing = await this.prisma.comment.findFirst({ where: { id, organizationId: apiKey.organizationId } });
    if (!existing) throw new NotFoundException("Comment not found");

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.update({
        where: { id },
        data: {
          ...(dto.body !== undefined ? { content: dto.body } : {}),
          ...(dto.clientVisible !== undefined ? { clientVisible: dto.clientVisible } : {}),
        },
      });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "comment",
        entityId: comment.id,
        action: "updated",
        before: existing,
        after: comment,
      });
      return { data: comment, auditEventId: event.id, created: false };
    });
  }

  private assertSingleTarget(taskId?: string, projectId?: string) {
    if ((taskId && projectId) || (!taskId && !projectId)) {
      throw new BadRequestException("Exactly one of taskId or projectId is required");
    }
  }

  private async assertTask(taskId: string, organizationId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId } });
    if (!task) throw new NotFoundException("Task not found");
  }

  private async assertProject(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException("Project not found");
  }
}
