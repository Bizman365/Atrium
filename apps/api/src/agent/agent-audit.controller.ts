import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { ApiKeyScopes } from "./decorators/api-key-scopes.decorator";
import { CurrentApiKey } from "./decorators/current-api-key.decorator";
import type { CurrentApiKeyContext } from "./decorators/current-api-key.decorator";
import { AgentAuditService } from "./agent-audit.service";
import { ListAgentAuditDto } from "./dto/list-audit.dto";

@Controller("agent/audit")
@UseGuards(ApiKeyGuard)
export class AgentAuditController {
  constructor(private service: AgentAuditService) {}

  @Get()
  @ApiKeyScopes("audit:read")
  async list(@Query() query: ListAgentAuditDto, @CurrentApiKey() apiKey: CurrentApiKeyContext): Promise<{ ok: true; data: unknown; meta: Record<string, never> }> {
    return { ok: true, data: await this.service.list(query, apiKey), meta: {} };
  }
}
