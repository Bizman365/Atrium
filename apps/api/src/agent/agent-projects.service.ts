import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@atrium/database";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AuditService } from "./services/audit.service";
import { CreateAgentProjectDto } from "./dto/create-project.dto";
import { UpdateAgentProjectDto } from "./dto/update-project.dto";
import { ListAgentProjectsDto } from "./dto/list-projects.dto";

export interface AgentResult<T> {
  data: T;
  auditEventId?: string | null;
  created?: boolean;
}

const PROJECT_COMPLETED_STATUSES = new Set(["completed", "done"]);

@Injectable()
export class AgentProjectsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(
    dto: CreateAgentProjectDto,
    apiKey: CurrentApiKeyContext,
    requestId: string,
  ): Promise<AgentResult<unknown>> {
    if (dto.externalId) {
      const existing = await this.prisma.project.findFirst({
        where: { organizationId: apiKey.organizationId, externalId: dto.externalId },
        include: { clients: { select: { userId: true } } },
      });
      if (existing) return { data: existing, auditEventId: null, created: false };
    }

    if (dto.clientId) await this.assertMember(dto.clientId, apiKey.organizationId);
    if (dto.status) await this.assertProjectStatus(dto.status, apiKey.organizationId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const completedAt = dto.status && PROJECT_COMPLETED_STATUSES.has(dto.status) ? new Date() : undefined;
        const project = await tx.project.create({
          data: {
            name: dto.name,
            description: dto.description,
            status: dto.status,
            slug: dto.slug,
            externalId: dto.externalId,
            source: "agent",
            completedAt,
            organizationId: apiKey.organizationId,
            ...(dto.clientId
              ? { clients: { create: [{ userId: dto.clientId }] } }
              : {}),
          },
          include: { clients: { select: { userId: true } } },
        });
        const event = await this.audit.writeAudit({
          tx,
          organizationId: apiKey.organizationId,
          apiKey,
          requestId,
          entityType: "project",
          entityId: project.id,
          action: "created",
          before: null,
          after: project,
        });
        return { data: project, auditEventId: event.id, created: true };
      });
    } catch (error) {
      if (isUniqueError(error)) throw new ConflictException("Project slug or externalId is already taken");
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateAgentProjectDto,
    apiKey: CurrentApiKeyContext,
    requestId: string,
  ): Promise<AgentResult<unknown>> {
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId: apiKey.organizationId },
      include: { clients: { select: { userId: true } } },
    });
    if (!existing) throw new NotFoundException("Project not found");
    if (existing.archivedAt) throw new BadRequestException("Cannot update an archived project");

    if (dto.status) await this.assertProjectStatus(dto.status, apiKey.organizationId);
    if (dto.clientId) await this.assertMember(dto.clientId, apiKey.organizationId);

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const shouldStampCompleted =
      statusChanged && dto.status !== undefined && PROJECT_COMPLETED_STATUSES.has(dto.status) && !existing.completedAt;

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.clientId !== undefined) {
          await tx.projectClient.deleteMany({ where: { projectId: id } });
        }

        const project = await tx.project.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
            ...(shouldStampCompleted ? { completedAt: new Date() } : {}),
            ...(dto.clientId
              ? { clients: { create: [{ userId: dto.clientId }] } }
              : {}),
          },
          include: { clients: { select: { userId: true } } },
        });
        const event = await this.audit.writeAudit({
          tx,
          organizationId: apiKey.organizationId,
          apiKey,
          requestId,
          entityType: "project",
          entityId: project.id,
          action: statusChanged ? "status_changed" : "updated",
          before: existing,
          after: project,
        });
        return { data: project, auditEventId: event.id, created: false };
      });
    } catch (error) {
      if (isUniqueError(error)) throw new ConflictException("Project slug is already taken");
      throw error;
    }
  }

  async list(query: ListAgentProjectsDto, apiKey: CurrentApiKeyContext) {
    const limit = Math.min(query.limit ?? 50, 200);
    const where: Prisma.ProjectWhereInput = { organizationId: apiKey.organizationId };
    if (query.clientId) where.clients = { some: { userId: query.clientId } };
    if (query.status) where.status = query.status;
    if (query.slug) where.slug = query.slug;
    if (query.cursor) where.createdAt = { lt: new Date(query.cursor) };

    const data = await this.prisma.project.findMany({
      where,
      include: { clients: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      items: data,
      nextCursor: data.length === limit ? data[data.length - 1]?.createdAt.toISOString() : null,
    };
  }

  async findOne(id: string, apiKey: CurrentApiKeyContext) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: apiKey.organizationId },
      include: { clients: { select: { userId: true } } },
    });
    if (!project) throw new NotFoundException("Project not found");
    const counts = await this.prisma.task.groupBy({
      by: ["status"],
      where: { projectId: id, organizationId: apiKey.organizationId },
      _count: { _all: true },
    });
    return {
      ...project,
      taskSummary: counts.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
      }, {}),
    };
  }

  private async assertMember(userId: string, organizationId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, organizationId } });
    if (!member) throw new BadRequestException("clientId/assigneeId is not a member of this organization");
  }

  private async assertProjectStatus(status: string, organizationId: string) {
    const valid = await this.prisma.projectStatus.findFirst({ where: { slug: status, organizationId } });
    if (!valid) throw new BadRequestException(`Invalid project status: ${status}`);
  }
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
