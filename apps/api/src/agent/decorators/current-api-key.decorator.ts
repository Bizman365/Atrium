import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentApiKeyContext {
  id: string;
  organizationId: string;
  keyPrefix: string;
  scopes: string[];
}

export const CurrentApiKey = createParamDecorator(
  (data: keyof CurrentApiKeyContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ apiKey?: CurrentApiKeyContext }>();
    const apiKey = request.apiKey;
    return data && apiKey ? apiKey[data] : apiKey;
  },
);
