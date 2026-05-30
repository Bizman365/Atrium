#!/bin/sh
set -e

VALIDATE_ONLY=false
if [ "${1:-}" = "--validate-only" ]; then
  VALIDATE_ONLY=true
  shift
fi

echo "=== Pexlo Portal Starting ==="

# Generate Prisma client at startup.
# Bun's centralized .bun store causes prisma generate's output
# (node_modules/.prisma/client/) to not survive the build → runner stage
# COPY for the unified Dockerfile. Re-generating at startup ensures the
# client + query-engine binaries land in the expected paths regardless
# of how Docker COPY handled symlinks during the build.
echo "[entrypoint] Generating Prisma client..."
cd /app
./packages/database/node_modules/.bin/prisma generate --schema=./packages/database/prisma/schema.prisma
echo "[entrypoint] ✅ Prisma client generated."

PG_RUNNING=false

# Start built-in PostgreSQL if no external DATABASE_URL is provided
if [ "${USE_BUILT_IN_DB}" = "true" ] || [ -z "${DATABASE_URL}" ]; then
  echo "Starting built-in PostgreSQL..."
  export PGDATA="/var/lib/postgresql/data"
  DB_USER="${POSTGRES_USER:-atrium}"
  DB_PASS="${POSTGRES_PASSWORD:-atrium}"
  DB_NAME="${POSTGRES_DB:-atrium}"
  PG_BIN="/usr/lib/postgresql/16/bin"

  # Initialize database if needed
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL data directory..."
    "$PG_BIN/initdb" -D "$PGDATA" -U "$DB_USER" --auth=trust >/dev/null 2>&1
    echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
    echo "unix_socket_directories = '/tmp'" >> "$PGDATA/postgresql.conf"

    # Start temporarily to create database and set password
    "$PG_BIN/pg_ctl" -D "$PGDATA" -w start -o "-k /tmp" >/dev/null 2>&1
    "$PG_BIN/psql" -U "$DB_USER" -h /tmp -c "ALTER USER $DB_USER PASSWORD '$DB_PASS';" >/dev/null 2>&1
    "$PG_BIN/psql" -U "$DB_USER" -h /tmp -c "CREATE DATABASE $DB_NAME;" >/dev/null 2>&1 || true
    "$PG_BIN/pg_ctl" -D "$PGDATA" -w stop >/dev/null 2>&1
  fi

  "$PG_BIN/pg_ctl" -D "$PGDATA" -w start -o "-k /tmp" >/dev/null 2>&1
  PG_RUNNING=true
  echo "PostgreSQL started."
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
else
  MASKED_DATABASE_URL=$(printf '%s\n' "$DATABASE_URL" | sed 's/:[^@]*@/:****@/')
  echo "Using external database: $MASKED_DATABASE_URL"
fi

# Ensure DIRECT_URL is set (Prisma schema references it; falls back to DATABASE_URL)
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

# Apply database migrations safely (skip with SKIP_DB_PUSH=true for backward-compatible emergency starts)
cd /app
if [ "${SKIP_DB_PUSH}" = "true" ]; then
  echo "Skipping database migrations (SKIP_DB_PUSH=true)"
else
  MIGRATION_URL="${DIRECT_URL:-$DATABASE_URL}"
  MASKED_MIGRATION_URL=$(printf '%s\n' "$MIGRATION_URL" | sed 's/:[^@]*@/:****@/')

  echo "[entrypoint] Database migration target: $MASKED_MIGRATION_URL"

  IMAGE_MIGRATIONS_DIR="/app/packages/database/prisma/migrations"
  IMAGE_MIGRATION_NAMES=$(find "$IMAGE_MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort || true)
  IMAGE_MIGRATIONS=$(printf '%s\n' "$IMAGE_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')

  echo "[entrypoint] Migrations in image ($IMAGE_MIGRATIONS):"
  if [ "$IMAGE_MIGRATIONS" -eq 0 ]; then
    echo "[entrypoint]   (none)"
  else
    printf '%s\n' "$IMAGE_MIGRATION_NAMES" | sed 's/^/[entrypoint]   - /'
  fi

  DB_TABLE_EXISTS=$(psql "$MIGRATION_URL" -tA -c "SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN '0' ELSE '1' END;")
  if [ "$DB_TABLE_EXISTS" = "1" ]; then
    DB_MIGRATION_NAMES=$(psql "$MIGRATION_URL" -tA -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;")
  else
    DB_MIGRATION_NAMES=""
  fi
  DB_MIGRATIONS=$(printf '%s\n' "$DB_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')

  echo "[entrypoint] Finished migrations in DB ($DB_MIGRATIONS):"
  if [ "$DB_MIGRATIONS" -eq 0 ]; then
    echo "[entrypoint]   (none)"
  else
    printf '%s\n' "$DB_MIGRATION_NAMES" | sed 's/^/[entrypoint]   - /'
  fi

  if [ "$DB_MIGRATIONS" -gt "$IMAGE_MIGRATIONS" ]; then
    echo "[entrypoint] ❌ ABORT: Database has $DB_MIGRATIONS finished migrations but image only has $IMAGE_MIGRATIONS."
    echo "[entrypoint] This image appears OLDER than the database schema."
    echo "[entrypoint] Refusing to start. This prevents rollback-induced schema/data loss."
    echo "[entrypoint] See PXL-18 + AGENTS.md Hard Rule 11."
    exit 1
  fi

  for migration in $DB_MIGRATION_NAMES; do
    if ! printf '%s\n' "$IMAGE_MIGRATION_NAMES" | grep -Fxq "$migration"; then
      echo "[entrypoint] ❌ ABORT: Database migration '$migration' is not present in this image."
      echo "[entrypoint] This image may be older or built from a divergent migration history."
      echo "[entrypoint] Refusing to start to prevent schema drift/data loss."
      echo "[entrypoint] See PXL-18 + AGENTS.md Hard Rule 11."
      exit 1
    fi
  done

  echo "[entrypoint] Running prisma migrate deploy (additive-only)..."
  DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma migrate deploy --schema=./packages/database/prisma/schema.prisma

  POST_DB_MIGRATION_NAMES=$(psql "$MIGRATION_URL" -tA -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name;" 2>/dev/null || true)
  POST_DB_MIGRATIONS=$(printf '%s\n' "$POST_DB_MIGRATION_NAMES" | sed '/^$/d' | wc -l | tr -d ' ')
  APPLIED_MIGRATIONS=$((POST_DB_MIGRATIONS - DB_MIGRATIONS))
  if [ "$APPLIED_MIGRATIONS" -gt 0 ]; then
    echo "[entrypoint] ✅ Applied $APPLIED_MIGRATIONS pending migration(s)."
  else
    echo "[entrypoint] ✅ No pending migrations; database already matches image history."
  fi

  # Legacy one-time data migrations. These are idempotent and now run after safe Prisma migrations.
  echo "[entrypoint] Running idempotent data migrations..."
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-file-documents.ts
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-task-completed-to-status.ts

  # Apply partial unique index on time_entry (one running entry per user)
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-time-entry-running-unique.ts

  # Apply Row Level Security (locks out Supabase anon/authenticated roles)
  # Only needed when using Supabase — set SUPABASE=true to activate
  if [ "${SUPABASE}" = "true" ]; then
    echo "Applying Row Level Security..."
    DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/apply-rls.ts
    echo "RLS applied."
  fi
fi

if [ "$VALIDATE_ONLY" = "true" ]; then
  echo "[entrypoint] ✅ Validation complete; exiting before app startup (--validate-only)."
  exit 0
fi

# Start NestJS API in background
echo "Starting API server on :3001..."
cd /app/apps/api
PORT=3001 node -e "
process.on('uncaughtException', (e) => { console.error('API UNCAUGHT:', e.stack || e); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('API UNHANDLED REJECTION:', e?.stack || e); process.exit(1); });
try { require('./dist/main'); }
catch(e) { console.error('API FATAL:', e.stack || e); process.exit(1); }
" &
API_PID=$!

# Start Next.js in background
echo "Starting Web server on :3000..."
cd /app
HOSTNAME=127.0.0.1 PORT=3000 node apps/web/server.js &
WEB_PID=$!

# Graceful shutdown
cleanup() {
  kill $API_PID $WEB_PID 2>/dev/null
  wait $API_PID $WEB_PID 2>/dev/null
  if [ "$PG_RUNNING" = "true" ]; then
    echo "Stopping PostgreSQL..."
    /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA" -w stop >/dev/null 2>&1
  fi
}
trap cleanup TERM INT

# Wait for API to be ready
echo "Waiting for API..."
for i in $(seq 1 30); do
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "API failed to start. Check logs above."
    break
  fi
  if wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo "API ready (took ${i}s)"
    break
  fi
  sleep 1
done

# Start Caddy reverse proxy in foreground
echo "Starting reverse proxy on :8080..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
