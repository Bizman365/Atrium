import "reflect-metadata";
import { describe, expect, it } from "bun:test";
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard } from "./api-key.guard";
import { API_KEY_SCOPES_KEY } from "../decorators/api-key-scopes.decorator";
import type { ValidatedApiKey } from "../services/api-key.service";

const token = "pxl_live_abcdefghijklmnopqrstuvwxyz012345";

function context(auth: string | undefined, requiredScopes: string[] = []): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(API_KEY_SCOPES_KEY, requiredScopes, handler);
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: auth } }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getClass: () => ({}),
    getHandler: () => handler,
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as unknown as ReturnType<ExecutionContext["switchToRpc"]>),
    switchToWs: () => ({} as unknown as ReturnType<ExecutionContext["switchToWs"]>),
    getType: () => "http" as const,
  } as unknown as ExecutionContext;
}

function apiKey(overrides: Partial<ValidatedApiKey> = {}): ValidatedApiKey {
  return {
    id: "key_1",
    organizationId: "org_1",
    keyPrefix: "pxl_live_abcdefg",
    scopes: ["projects:write"],
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function service(key: ValidatedApiKey | null) {
  let touches = 0;
  return {
    get touches() { return touches; },
    findByRawToken: async () => key,
    touchLastUsed: async (found: ValidatedApiKey) => {
      if (found.lastUsedAt && Date.now() - found.lastUsedAt.getTime() < 60_000) return;
      touches += 1;
      found.lastUsedAt = new Date();
    },
  };
}

describe("ApiKeyGuard", () => {
  it("allows valid token with matching scope", async () => {
    const mockService = service(apiKey());
    const guard = new ApiKeyGuard(new Reflector(), mockService as never);
    await expect(guard.canActivate(context(`Bearer ${token}`, ["projects:write"]))).resolves.toBe(true);
    expect(mockService.touches).toBe(1);
  });

  it("rejects valid token with missing scope as 403", async () => {
    const guard = new ApiKeyGuard(new Reflector(), service(apiKey()) as never);
    await expect(guard.canActivate(context(`Bearer ${token}`, ["projects:read"]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects invalid token as 401", async () => {
    const guard = new ApiKeyGuard(new Reflector(), service(null) as never);
    await expect(guard.canActivate(context("Bearer bad", ["projects:write"]))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects revoked token as 401", async () => {
    const guard = new ApiKeyGuard(new Reflector(), service(apiKey({ revokedAt: new Date() })) as never);
    await expect(guard.canActivate(context(`Bearer ${token}`, ["projects:write"]))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects missing Authorization header as 401", async () => {
    const guard = new ApiKeyGuard(new Reflector(), service(apiKey()) as never);
    await expect(guard.canActivate(context(undefined, ["projects:write"]))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("debounces lastUsedAt updates", async () => {
    const mockService = service(apiKey({ lastUsedAt: new Date() }));
    const guard = new ApiKeyGuard(new Reflector(), mockService as never);
    await expect(guard.canActivate(context(`Bearer ${token}`, ["projects:write"]))).resolves.toBe(true);
    expect(mockService.touches).toBe(0);
  });
});
