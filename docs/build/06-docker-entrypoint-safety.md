# Docker Entrypoint Safety (PXL-18)

## 1. What

The Docker startup path now uses `prisma migrate deploy` plus a migration drift guard instead of runtime schema push/sync commands.

## 2. Why

On May 29, 2026, a Pexlo Portal rollback image started with an older Prisma schema and the entrypoint ran destructive schema sync on boot. That silently dropped the PXL-6/PXL-7 tables and agent columns (`api_key`, `audit_event`, `task_deliverable`, agent fields). Recovery was possible only because a Neon safety branch existed.

This doc is the permanent record for the PXL-18 fix. Reference: `~/.openclaw/workspace/memory/2026-05-29.md`, section “PXL-6 Deploy Recovery”.

## 3. Considered & Rejected

- **Keep schema push and add manual safety checks** — rejected. The command itself can still mutate/drop on rollback.
- **Remove the migration step entirely** — rejected. Containers still need safe schema convergence for pending migrations.
- **Use an accept-data-loss schema push flag** — rejected. That is the exact class of behavior that caused the incident.
- **Add a confirmation prompt** — rejected. Containers do not have interactive stdin during deploy.
- **Only fix `docker/unified-entrypoint.sh`** — rejected. `docker/api-entrypoint.sh` also had the unsafe command, so it was made safe too even though unified is the current Hetzner path.

## 4. What We Built

### Entrypoints changed

- `docker/unified-entrypoint.sh` — actual unified production entrypoint from `docker/unified.Dockerfile`.
- `docker/api-entrypoint.sh` — legacy/API-only entrypoint, updated so no Docker entrypoint keeps the unsafe path.
- `docker/api.Dockerfile` — installs `postgresql-client` for the drift guard and mirrors the unified Dockerfile’s local Prisma generate flow.

### Original destructive lines

```sh
DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma db push --schema=./packages/database/prisma/schema.prisma --skip-generate 2>/dev/null || true
DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma db push --schema=./packages/database/prisma/schema.prisma --skip-generate --accept-data-loss
```

### New startup flow

1. Mask and print the DB target.
2. List migration directories packaged in the image.
3. Query finished migrations in `public._prisma_migrations`.
4. Abort if DB migration count is greater than image migration count.
5. Abort if any finished DB migration name is missing from the image.
6. Run `prisma migrate deploy`.
7. Print applied/no-op result.
8. Run existing idempotent data/index/RLS scripts.
9. `--validate-only` exits before app startup for container verification.

### Migration alignment included

The test/production DB already had `20260529124500_add_deliverable_externalid_source`, but `main` did not. This branch includes that migration and matching schema fields so the new guard does not incorrectly reject the image as older than the database.

<details>
<summary>Original unified entrypoint contents from main</summary>

```sh
#!/bin/sh
set -e

echo "=== Atrium Starting ==="

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
  echo "Using external database: ${DATABASE_URL%%@*}@***"
fi

# Ensure DIRECT_URL is set (Prisma schema references it; falls back to DATABASE_URL)
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

# Sync database schema (skip with SKIP_DB_PUSH=true for pooled connections)
cd /app
if [ "${SKIP_DB_PUSH}" = "true" ]; then
  echo "Skipping database schema push (SKIP_DB_PUSH=true)"
else
  MIGRATION_URL="${DIRECT_URL:-$DATABASE_URL}"

  # First, create new tables without dropping old columns
  echo "Creating new tables..."
  DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma db push --schema=./packages/database/prisma/schema.prisma --skip-generate 2>/dev/null || true

  # Migrate legacy document data from file table to document table
  echo "Running data migrations..."
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-file-documents.ts || true
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-task-completed-to-status.ts || true

  # Now push schema with accept-data-loss to drop old columns
  echo "Syncing database schema..."
  DATABASE_URL="$MIGRATION_URL" ./packages/database/node_modules/.bin/prisma db push --schema=./packages/database/prisma/schema.prisma --skip-generate --accept-data-loss
  echo "Database schema synced."

  # Apply partial unique index on time_entry (one running entry per user)
  DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/migrate-time-entry-running-unique.ts || true

  # Apply Row Level Security (locks out Supabase anon/authenticated roles)
  # Only needed when using Supabase — set SUPABASE=true to activate
  if [ "${SUPABASE}" = "true" ]; then
    echo "Applying Row Level Security..."
    DATABASE_URL="$MIGRATION_URL" bun run ./packages/database/scripts/apply-rls.ts
    echo "RLS applied."
  fi
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

```

</details>

## 5. How to Extend

- Add more pre-flight guards before `migrate deploy` if needed: required extensions, schema owner, DB host allowlist, or failed Prisma migration detection.
- Send abort events to Better Stack/Slack once deployment observability is wired.
- Move legacy one-time data scripts into formal Prisma migration SQL when those paths are touched again.
- Keep rollback safety invariant: image migration history must be a superset of DB finished migration history.

## 6. Verification

### Pre-flight DB target and safety backup

- Test DB marker verified: `ep-wispy-darkness`.
- Safety backup created before test DB mutation: `~/.openclaw/workspace/artifacts/pxl-18-test-db-backups/prisma-migrations-20260529-151038.sql`.
- `_prisma_migrations` rows before fake drift insert: `3`.

### Unified Docker image build

```text
#34 [runner 11/17] COPY --from=build /app/apps/web/.next/standalone ./
#34 DONE 0.6s

#35 [runner 12/17] COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
#35 DONE 0.0s

#36 [runner 13/17] COPY --from=build /app/apps/web/public ./apps/web/public
#36 DONE 0.0s

#37 [runner 14/17] COPY docker/Caddyfile /etc/caddy/Caddyfile
#37 DONE 0.0s

#38 [runner 15/17] COPY docker/unified-entrypoint.sh /app/unified-entrypoint.sh
#38 DONE 0.0s

#39 [runner 16/17] RUN chmod +x /app/unified-entrypoint.sh
#39 DONE 0.1s

#40 [runner 17/17] RUN mkdir -p /app/uploads && chown -R bun:bun /app
#40 DONE 40.4s

#41 exporting to image
#41 exporting layers
#41 exporting layers 31.3s done
#41 exporting manifest sha256:71f900ec0a4a12e85efc9c88e2d0e6b54074a57961ddcbfac62c3fe9afcb9a5a done
#41 exporting config sha256:a7619fec0c91a112095926f9aa4ba8a3dccfb7325b7a955184c5de5c61df0e80 done
#41 exporting attestation manifest sha256:1abcdd5b3776826d4326c028eb221ca0b3c190875a3de59289d828bb63bc8572 done
#41 exporting manifest list sha256:6df432d5786535ef826e760391fa87dd5a15b643cbfa0b9f45c1c99e574c52f9 done
#41 naming to docker.io/library/pexlo-portal:pxl-18-test done
#41 unpacking to docker.io/library/pexlo-portal:pxl-18-test
#41 unpacking to docker.io/library/pexlo-portal:pxl-18-test 16.3s done
#41 DONE 47.7s

 [33m1 warning found (use docker --debug to expand):
[0m - SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "SENTRY_AUTH_TOKEN") (line 36)
```

### Unified validate-only run against TEST_DATABASE_URL

```text
=== Pexlo Portal Starting ===
Using external database: postgresql:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
[entrypoint] Database migration target: postgresql:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
[entrypoint] Migrations in image (3):
[entrypoint]   - 20260529110000_baseline_existing_neon_schema
[entrypoint]   - 20260529111100_add_agent_layer_minimal
[entrypoint]   - 20260529124500_add_deliverable_externalid_source
[entrypoint] Finished migrations in DB (3):
[entrypoint]   - 20260529110000_baseline_existing_neon_schema
[entrypoint]   - 20260529111100_add_agent_layer_minimal
[entrypoint]   - 20260529124500_add_deliverable_externalid_source
[entrypoint] Running prisma migrate deploy (additive-only)...
Prisma schema loaded from packages/database/prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech"

3 migrations found in prisma/migrations


No pending migrations to apply.
[entrypoint] ✅ No pending migrations; database already matches image history.
[entrypoint] Running idempotent data migrations...
Legacy document columns not found on file table — nothing to migrate.
[backfill] Legacy task.completed column not found — skipping backfill.
[sanitize] No dangling task FK references found.
Applied partial unique index: time_entry_one_running_per_user
[entrypoint] ✅ Validation complete; exiting before app startup (--validate-only).

```

### Drift guard proof

A fake future migration was inserted into the test DB, the container was run, and it exited with code `1`. The fake row was then deleted.

```text
=== Pexlo Portal Starting ===
Using external database: postgresql:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
[entrypoint] Database migration target: postgresql:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
[entrypoint] Migrations in image (3):
[entrypoint]   - 20260529110000_baseline_existing_neon_schema
[entrypoint]   - 20260529111100_add_agent_layer_minimal
[entrypoint]   - 20260529124500_add_deliverable_externalid_source
[entrypoint] Finished migrations in DB (4):
[entrypoint]   - 20260529110000_baseline_existing_neon_schema
[entrypoint]   - 20260529111100_add_agent_layer_minimal
[entrypoint]   - 20260529124500_add_deliverable_externalid_source
[entrypoint]   - 99999999999999_fake_future_migration
[entrypoint] ❌ ABORT: Database has 4 finished migrations but image only has 3.
[entrypoint] This image appears OLDER than the database schema.
[entrypoint] Refusing to start. This prevents rollback-induced schema/data loss.
[entrypoint] See PXL-18 + AGENTS.md Hard Rule 11.

```

Cleanup verified:

```text
Test DB final migration count: 3
Fake future migrations left: 0
```

### API Docker image build + validate-only

`docker/api.Dockerfile` was also built because the API entrypoint was changed.

```text

#29 [runner  8/11] COPY docker/api-entrypoint.sh /app/api-entrypoint.sh
#29 DONE 0.0s

#30 [runner  9/11] RUN chmod +x /app/api-entrypoint.sh
#30 DONE 0.1s

#31 [runner 10/11] RUN mkdir -p /app/uploads && chown -R bun:bun /app
#31 DONE 34.2s

#32 [runner 11/11] WORKDIR /app/apps/api
#32 DONE 0.2s

#33 exporting to image
#33 exporting layers
#33 exporting layers 26.8s done
#33 exporting manifest sha256:70bafa971396ebf24d9aa44283c7f0af40bb9e9536e92c09f0a544b91f9c8811
#33 exporting manifest sha256:70bafa971396ebf24d9aa44283c7f0af40bb9e9536e92c09f0a544b91f9c8811 done
#33 exporting config sha256:ef281c321ec79a4f50734e57181953f72ddc5de9c42c3549976d404575a2f4f8 done
#33 exporting attestation manifest sha256:799d178d600907bbfbd4c4a14c09418bcf7131843d0ee1d293edf5ce1ae848ea done
#33 exporting manifest list sha256:6668549db60932573f21a0f3575012bd2e8d4d9315f1ffc465aac06903889a88 done
#33 naming to docker.io/library/pexlo-api:pxl-18-test done
#33 unpacking to docker.io/library/pexlo-api:pxl-18-test
#33 unpacking to docker.io/library/pexlo-api:pxl-18-test 13.3s done
#33 DONE 40.1s
```

```text
[api-entrypoint] Database migration target: postgresql:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
[api-entrypoint] Migrations in image (3):
[api-entrypoint]   - 20260529110000_baseline_existing_neon_schema
[api-entrypoint]   - 20260529111100_add_agent_layer_minimal
[api-entrypoint]   - 20260529124500_add_deliverable_externalid_source
[api-entrypoint] Finished migrations in DB (3):
[api-entrypoint]   - 20260529110000_baseline_existing_neon_schema
[api-entrypoint]   - 20260529111100_add_agent_layer_minimal
[api-entrypoint]   - 20260529124500_add_deliverable_externalid_source
[api-entrypoint] Running prisma migrate deploy (additive-only)...
Prisma schema loaded from packages/database/prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech"

3 migrations found in prisma/migrations


No pending migrations to apply.
[api-entrypoint] ✅ No pending migrations; database already matches image history.
[api-entrypoint] Running idempotent data migrations...
Legacy document columns not found on file table — nothing to migrate.
[backfill] Legacy task.completed column not found — skipping backfill.
[sanitize] No dangling task FK references found.
Applied partial unique index: time_entry_one_running_per_user
[api-entrypoint] ✅ Validation complete; exiting before API startup (--validate-only).

```


### Production migration baseline check (read-only)

Masked prod target was printed before querying: `ep-morning-forest-aqndvm5t-pooler`. Existing finished migration rows verified:

```text
20260529110000_baseline_existing_neon_schema
20260529111100_add_agent_layer_minimal
20260529124500_add_deliverable_externalid_source
```

### Static checks

```text
git diff --check: pass
grep -rE "db push|db:push|prisma.*push|accept-data-loss" docker/: no matches
```

## 7. Known Gaps / Deferred

- This guard blocks rollback-to-older-image migration history, but it does not prove every migration is semantically non-destructive.
- It cannot detect unsafe column type changes inside a future migration SQL file; migration review is still required.
- No Slack/Better Stack alert on abort yet.
- `SKIP_DB_PUSH=true` remains as a backward-compatible emergency bypass; it should be renamed or removed once deployment runbooks are stable.

## 8. References

- Linear: PXL-18
- Memory: `~/.openclaw/workspace/memory/2026-05-29.md` — “PXL-6 Deploy Recovery” and “The Test Database Incident”
- Rules: `~/.openclaw/workspace/AGENTS.md` Hard Rule 11 (migration safety checklist)
- Verification: `~/.openclaw/workspace/VERIFICATION.md` May 29 test database isolation rule
