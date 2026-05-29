import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyScopes } from "./decorators/api-key-scopes.decorator";
import { CurrentApiKey } from "./decorators/current-api-key.decorator";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AgentTasksService } from "./agent-tasks.service";
import { CreateAgentTaskDto } from "./dto/create-task.dto";
import { UpdateAgentTaskDto } from "./dto/update-task.dto";

@Controller("agent/tasks")
@UseGuards(ApiKeyGuard)
export class AgentTasksController {
  constructor(private service: AgentTasksService) {}

  @Post()
  @ApiKeyScopes("tasks:write")
  async create(
    @Body() dto: CreateAgentTaskDto,
    @CurrentApiKey() apiKey: CurrentApiKeyContext,
    @Headers("x-request-id") requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(dto, apiKey, requestId ?? randomUUID());
    if (result.created === false) res.status(HttpStatus.OK);
    return response(result.data, result.auditEventId);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiKeyScopes("tasks:write")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateAgentTaskDto,
    @CurrentApiKey() apiKey: CurrentApiKeyContext,
    @Headers("x-request-id") requestId?: string,
  ) {
    const result = await this.service.update(id, dto, apiKey, requestId ?? randomUUID());
    return response(result.data, result.auditEventId);
  }
}

function response(data: unknown, auditEventId?: string | null) {
  return { ok: true, data, meta: auditEventId !== undefined ? { auditEventId } : {} };
}
