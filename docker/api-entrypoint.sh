#!/bin/sh
set -e

VALIDATE_ONLY=false
if [ "${1:-}" = "--validate-only" ]; then
  VALIDATE_ONLY=true
  shift
fi

MIGRATION_URL="${DIRECT_URL:-$DATABASE_URL}"
MASKED_MIGRATION_URL=$(printf '%s\n' "$MIGRATION_URL" | sed 's/:[^@]*@/:****@/')

echo "[api-entrypoint] Database migration target: $MASKED_MIGRATION_URL"

cd /app
IMAGE_MIGRATIONS_DIR="/app/packages/database/prisma/migrations"
IMAGE_MIGRATION_NAMES=$(find "$IMAGE_MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort || true)
IMAGE_MIGRATIONS=$(printf '%s\n' "$IMAGE_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')

echo "[api-entrypoint] Migrations in image ($IMAGE_MIGRATIONS):"
if [ "$IMAGE_MIGRATIONS" -eq 0 ]; then
  echo "[api-entrypoint]   (none)"
else
  printf '%s\n' "$IMAGE_MIGRATION_NAMES" | sed 's/^/[api-entrypoint]   - /'
fi

DB_TABLE_EXISTS=$(psql "$MIGRATION_URL" -tA -c "SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN '0' ELSE '1' END;")
if [ "$DB_TABLE_EXISTS" = "1" ]; then
  DB_MIGRATION_NAMES=$(psql "$MIGRATION_URL" -tA -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;")
else
  DB_MIGRATION_NAMES=""
fi
DB_MIGRATIONS=$(printf '%s\n' "$DB_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')

echo "[api-entrypoint] Finished migrations in DB ($DB_MIGRATIONS):"
if [ "$DB_MIGRATIONS" -eq 0 ]; then
  echo "[api-entrypoint]   (none)"
else
  printf '%s\n' "$DB_MIGRATION_NAMES" | sed 's/^/[api-entrypoint]   - /'
fi

if [ "$DB_MIGRATIONS" -gt "$IMAGE_MIGRATIONS" ]; then
  echo "[api-entrypoint] ❌ ABORT: Database has $DB_MIGRATIONS finished migrations but image only has $IMAGE_MIGRATIONS."
  echo "[api-entrypoint] This image appears OLDER than the database schema."
  echo "[api-entrypoint] Refusing to start. This prevents rollback-induced schema/data loss."
  echo "[api-entrypoint] See PXL-18 + AGENTS.md Hard Rule 11."
  exit 1
fi

for migration in $DB_MIGRATION_NAMES; do
  if ! printf '%s\n' "$IMAGE_MIGRATION_NAMES" | grep -Fxq "$migration"; then
    echo "[api-entrypoint] ❌ ABORT: Database migration '$migration' is not present in this image."
    echo "[api-entrypoint] This image may be older or built from a divergent migration history."
    echo "[api-entrypoint] Refusing to start to prevent schema drift/data loss."
    echo "[api-entrypoint] See PXL-18 + AGENTS.md Hard Rule 11."
    exit 1
  fi
done

echo "[api-entrypoint] Running prisma migrate deploy (additive-only)..."
DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma migrate deploy --schema=./packages/database/prisma/schema.prisma

POST_DB_MIGRATION_NAMES=$(psql "$MIGRATION_URL" -tA -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;" 2>/dev/null || true)
POST_DB_MIGRATIONS=$(printf '%s\n' "$POST_DB_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')
APPLIED_MIGRATIONS=$((POST_DB_MIGRATIONS - DB_MIGRATIONS))
if [ "$APPLIED_MIGRATIONS" -gt 0 ]; then
  echo "[api-entrypoint] ✅ Applied $APPLIED_MIGRATIONS pending migration(s)."
else
  echo "[api-entrypoint] ✅ No pending migrations; database already matches image history."
fi

echo "[api-entrypoint] Running idempotent data migrations..."
DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-file-documents.ts
DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-task-completed-to-status.ts
DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-time-entry-running-unique.ts

if [ "${SUPABASE}" = "true" ]; then
  echo "Applying Row Level Security..."
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/apply-rls.ts
  echo "RLS applied."
fi

if [ "$VALIDATE_ONLY" = "true" ]; then
  echo "[api-entrypoint] ✅ Validation complete; exiting before API startup (--validate-only)."
  exit 0
fi

cd /app/apps/api
exec bun run start:prod
