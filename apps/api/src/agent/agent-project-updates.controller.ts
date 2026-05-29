import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyScopes } from "./decorators/api-key-scopes.decorator";
import { CurrentApiKey } from "./decorators/current-api-key.decorator";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AgentProjectUpdatesService } from "./agent-project-updates.service";
import { CreateAgentProjectUpdateDto, ListAgentProjectUpdatesDto, UpdateAgentProjectUpdateDto } from "./dto/project-update.dto";

@Controller("agent/project-updates")
@UseGuards(ApiKeyGuard)
export class AgentProjectUpdatesController {
  constructor(private service: AgentProjectUpdatesService) {}

  @Post()
  @ApiKeyScopes("projects:write")
  async create(@Body() dto: CreateAgentProjectUpdateDto, @CurrentApiKey() apiKey: CurrentApiKeyContext, @Headers("x-request-id") requestId: string | undefined, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.create(dto, apiKey, requestId ?? randomUUID());
    if (result.created === false) res.status(HttpStatus.OK);
    return response(result.data, result.auditEventId);
  }

  @Get()
  @ApiKeyScopes("projects:read")
  async list(@Query() query: ListAgentProjectUpdatesDto, @CurrentApiKey() apiKey: CurrentApiKeyContext) {
    return response(await this.service.list(query, apiKey));
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiKeyScopes("projects:write")
  async update(@Param("id") id: string, @Body() dto: UpdateAgentProjectUpdateDto, @CurrentApiKey() apiKey: CurrentApiKeyContext, @Headers("x-request-id") requestId?: string) {
    const result = await this.service.update(id, dto, apiKey, requestId ?? randomUUID());
    return response(result.data, result.auditEventId);
  }
}

function response(data: unknown, auditEventId?: string | null) {
  return { ok: true, data, meta: auditEventId !== undefined ? { auditEventId } : {} };
}
