import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_KEY_SCOPES_KEY } from "../decorators/api-key-scopes.decorator";
import { ApiKeyService, ValidatedApiKey } from "../services/api-key.service";

interface AgentRequest {
  headers: Record<string, string | string[] | undefined>;
  apiKey?: ValidatedApiKey;
  organization?: { id: string };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const rawAuth = request.headers.authorization;
    const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header");
    }

    const token = authorization.slice("Bearer ".length).trim();
    const apiKey = await this.apiKeyService.findByRawToken(token);
    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException("Invalid API key");
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    const hasRequiredScopes = requiredScopes.every((scope) => apiKey.scopes.includes(scope));
    if (!hasRequiredScopes) {
      throw new ForbiddenException("API key is missing required scope");
    }

    await this.apiKeyService.touchLastUsed(apiKey);
    request.apiKey = apiKey;
    request.organization = { id: apiKey.organizationId };
    return true;
  }
}
