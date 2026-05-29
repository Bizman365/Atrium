import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import type { ApiKey } from "@atrium/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface ValidatedApiKey {
  id: string;
  organizationId: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export const API_KEY_PREFIX = "pxl_live_";
export const API_KEY_TOKEN_REGEX = /^pxl_live_[A-Za-z0-9_-]{32}$/;
export const API_KEY_LAST_USED_DEBOUNCE_MS = 60_000;

export function generateRawApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function apiKeyDisplayPrefix(token: string): string {
  return token.slice(0, 16);
}

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  hashToken(token: string): string {
    return hashApiKey(token);
  }

  async findByRawToken(token: string): Promise<ValidatedApiKey | null> {
    if (!API_KEY_TOKEN_REGEX.test(token)) return null;
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.hashToken(token) },
    });
    return key ? this.toValidated(key) : null;
  }

  async touchLastUsed(key: ValidatedApiKey, now = new Date()): Promise<void> {
    if (
      key.lastUsedAt &&
      now.getTime() - key.lastUsedAt.getTime() < API_KEY_LAST_USED_DEBOUNCE_MS
    ) {
      return;
    }
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: now },
    });
    key.lastUsedAt = now;
  }

  private toValidated(key: ApiKey): ValidatedApiKey {
    return {
      id: key.id,
      organizationId: key.organizationId,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
    };
  }
}
