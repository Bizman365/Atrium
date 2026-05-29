FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/email/package.json ./packages/email/
RUN bun install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
# Restore workspace node_modules (overwritten by COPY . . since .dockerignore excludes node_modules)
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/email/node_modules ./packages/email/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
RUN packages/database/node_modules/.bin/prisma generate --schema=packages/database/prisma/schema.prisma
RUN bun run --filter @atrium/email build
RUN bun run --filter @atrium/api build

# Production
FROM base AS runner
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/email ./packages/email

COPY docker/api-entrypoint.sh /app/api-entrypoint.sh
RUN chmod +x /app/api-entrypoint.sh

RUN mkdir -p /app/uploads && chown -R bun:bun /app
USER bun
WORKDIR /app/apps/api
EXPOSE 3001
ENTRYPOINT ["/app/api-entrypoint.sh"]
