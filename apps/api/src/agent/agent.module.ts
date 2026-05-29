import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentProjectsController } from "./agent-projects.controller";
import { AgentTasksController } from "./agent-tasks.controller";
import { AgentDeliverablesController } from "./agent-deliverables.controller";
import { AgentAuditController } from "./agent-audit.controller";
import { AgentProjectsService } from "./agent-projects.service";
import { AgentTasksService } from "./agent-tasks.service";
import { AgentDeliverablesService } from "./agent-deliverables.service";
import { AgentAuditService } from "./agent-audit.service";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyService } from "./services/api-key.service";
import { AuditService } from "./services/audit.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    AgentProjectsController,
    AgentTasksController,
    AgentDeliverablesController,
    AgentAuditController,
  ],
  providers: [
    AgentProjectsService,
    AgentTasksService,
    AgentDeliverablesService,
    AgentAuditService,
    ApiKeyGuard,
    ApiKeyService,
    AuditService,
  ],
})
export class AgentModule {}
