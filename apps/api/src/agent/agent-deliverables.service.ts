import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AuditService } from "./services/audit.service";
import { CreateAgentDeliverableDto } from "./dto/create-deliverable.dto";
import type { AgentResult } from "./agent-projects.service";

@Injectable()
export class AgentDeliverablesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(taskId: string, dto: CreateAgentDeliverableDto, apiKey: CurrentApiKeyContext, requestId: string): Promise<AgentResult<unknown>> {
    if (!dto.url && !dto.fileId) throw new BadRequestException("Either url or fileId is required");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId: apiKey.organizationId } });
    if (!task) throw new NotFoundException("Task not found");
    if (dto.fileId) {
      const file = await this.prisma.file.findFirst({ where: { id: dto.fileId, organizationId: apiKey.organizationId } });
      if (!file) throw new NotFoundException("File not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId,
          organizationId: apiKey.organizationId,
          title: dto.title,
          description: dto.description,
          type: dto.type ?? "link",
          fileId: dto.fileId,
          url: dto.url,
          clientVisible: dto.clientVisible ?? true,
        },
      });
      const event = await this.audit.writeAudit({
        tx,
        organizationId: apiKey.organizationId,
        apiKey,
        requestId,
        entityType: "deliverable",
        entityId: deliverable.id,
        action: "created",
        before: null,
        after: deliverable,
      });
      return { data: deliverable, auditEventId: event.id, created: true };
    });
  }
}
