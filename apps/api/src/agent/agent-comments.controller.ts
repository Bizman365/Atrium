import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyScopes } from "./decorators/api-key-scopes.decorator";
import { CurrentApiKey } from "./decorators/current-api-key.decorator";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AgentCommentsService } from "./agent-comments.service";
import { CreateAgentCommentDto, ListAgentCommentsDto, UpdateAgentCommentDto } from "./dto/comment.dto";

@Controller("agent/comments")
@UseGuards(ApiKeyGuard)
export class AgentCommentsController {
  constructor(private service: AgentCommentsService) {}

  @Post()
  @ApiKeyScopes("projects:write")
  async create(
    @Body() dto: CreateAgentCommentDto,
    @CurrentApiKey() apiKey: CurrentApiKeyContext,
    @Headers("x-request-id") requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.create(dto, apiKey, requestId ?? randomUUID());
    if (result.created === false) res.status(HttpStatus.OK);
    return response(result.data, result.auditEventId);
  }

  @Get()
  @ApiKeyScopes("projects:read")
  async list(@Query() query: ListAgentCommentsDto, @CurrentApiKey() apiKey: CurrentApiKeyContext) {
    return response(await this.service.list(query, apiKey));
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiKeyScopes("projects:write")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateAgentCommentDto,
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
