import { Body, Controller, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyScopes } from "./decorators/api-key-scopes.decorator";
import { CurrentApiKey } from "./decorators/current-api-key.decorator";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AgentDeliverablesService } from "./agent-deliverables.service";
import { CreateAgentDeliverableDto } from "./dto/create-deliverable.dto";

@Controller("agent/tasks/:id/deliverables")
@UseGuards(ApiKeyGuard)
export class AgentDeliverablesController {
  constructor(private service: AgentDeliverablesService) {}

  @Post()
  @ApiKeyScopes("deliverables:write")
  async create(
    @Param("id") id: string,
    @Body() dto: CreateAgentDeliverableDto,
    @CurrentApiKey() apiKey: CurrentApiKeyContext,
    @Headers("x-request-id") requestId?: string,
  ) {
    const result = await this.service.create(id, dto, apiKey, requestId ?? randomUUID());
    return { ok: true, data: result.data, meta: { auditEventId: result.auditEventId } };
  }
}
