# 05 — Test Database Isolation

## 1. What

PXL-17 adds hard test database isolation for Pexlo Portal: a long-lived Neon `test` branch, package-level preflight checks, direct `bun test` preload guards, and a reset script so tests cannot silently run against production data.

## 2. Why

On 2026-05-29, the API test suite was run while the repo only had production `DATABASE_URL`. Some tests truncated real project/task/deliverable tables and inserted fixtures. The CSP backfill was recovered only because a Neon safety branch existed.

The permanent rule is simple: tests are allowed to mutate data, but only in a disposable test database. Any path that tries to run tests without `TEST_DATABASE_URL`, or with a non-test database target, must abort before application test code runs.

## 3. Considered & Rejected

### Local Postgres

Rejected for the default workflow. Local Postgres is useful for isolated development, but it drifts from the Neon production shape and does not prove Prisma migrations behave against the real managed Postgres target.

### Docker test database

Rejected for now. Docker gives clean resets, but it adds developer-environment complexity and still risks schema/runtime drift from Neon. It can be added later for CI if the Neon branch becomes too slow or costly.

### In-memory SQLite

Rejected. The app uses Postgres/Prisma behavior, Neon connection strings, Postgres constraints, and SQL semantics. SQLite would make tests faster but less trustworthy for integration paths.

## 4. What We Built

### Neon branch

- Neon project: `spring-band-02975708`
- Parent production branch: `br-super-credit-aqwsbfbh`
- Test branch: `br-summer-art-aqqdzuc1` (`test`)
- Read/write endpoint host: `ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech`

### Files

- `packages/database/.env.test` — local-only secret file with `TEST_DATABASE_URL` and branch metadata. Ignored by git.
- `.env.test.example` — committed pattern for setting `TEST_DATABASE_URL` without real credentials.
- `scripts/preflight-tests.ts` — package-script preflight. It aborts when `TEST_DATABASE_URL` is missing or equal to production `DATABASE_URL`.
- `scripts/bun-test-guard.ts` — Bun test preload guard. It catches direct `bun test` invocations that bypass package scripts and requires `DATABASE_URL === TEST_DATABASE_URL` inside the test process.
- `scripts/reset-test-db.ts` — truncates every public table except `_prisma_migrations` on the test branch only.
- `bunfig.toml`, `apps/api/bunfig.toml`, `apps/web/bunfig.toml` — preload the direct Bun test guard.

### Package scripts

- Root `test` and `test:e2e` now source `packages/database/.env.test`, run preflight, then execute with `DATABASE_URL=$TEST_DATABASE_URL` and `DIRECT_URL=$TEST_DATABASE_URL`.
- `apps/api test` does the same before `bun test`.
- `apps/web test` does the same before `bun test`.
- Root and API package include `db:test:reset`.

## 5. How to Extend

### Adding tests

Use the package scripts unless you have a specific reason not to:

```bash
bun run --filter @atrium/api test
bun run test
```

For one file, still set the test database explicitly:

```bash
set -a; . packages/database/.env.test; set +a
cd apps/api
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" bun test src/path/to/file.spec.ts
```

Direct `bun test` without `TEST_DATABASE_URL` aborts before test code runs.

### Resetting the test database

```bash
bun run db:test:reset
```

This truncates data but keeps schema and `_prisma_migrations`. It refuses to run unless the environment identifies a test branch.

### Adding a staging test database

Create a separate Neon branch, then add a separate env file or CI secret. Do not reuse production `DATABASE_URL`. If the branch is not named `test`, extend the guard intentionally and document the new branch name here.

### Rotating the branch

1. Create a new Neon branch from production main.
2. Apply migrations with `DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL bunx prisma migrate deploy`.
3. Update local `packages/database/.env.test` and CI secrets.
4. Run the preflight failure/pass checks and one-file test proof again.

## 6. Verification

### Neon branch created

```text
branch id: br-summer-art-aqqdzuc1
branch name: test
endpoint host: ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech
state: ready
```

### Migrations applied to test branch

```text
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech"
2 migrations found in prisma/migrations
No pending migrations to apply.
```

### Schema parity

```text
main public table count: 43
test public table count: 43
main/test _prisma_migrations rows: 3/3
table-name diff: empty
```

### Preflight failure/pass checks

```text
CASE 1 — no TEST_DATABASE_URL
❌ ABORT: TEST_DATABASE_URL is not set. Tests refuse to run.
exit=1

CASE 2 — TEST_DATABASE_URL equals DATABASE_URL
❌ ABORT: TEST_DATABASE_URL is the same as DATABASE_URL.
exit=1

CASE 3 — valid test URL
✅ Test DB target: postgresql://neondb_owner:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
✅ Pre-flight passed. Tests may proceed.
exit=0
```

### Direct Bun test bypass blocked

```text
cd apps/api
env -u TEST_DATABASE_URL bun test src/agent/guards/api-key.guard.spec.ts

❌ ABORT: TEST_DATABASE_URL is not set. Tests refuse to run.
exit=1
```

### Manual one-file test run against test branch only

```text
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" bun test src/agent/guards/api-key.guard.spec.ts

✅ Bun test DB target: postgresql://neondb_owner:****@ep-wispy-darkness-aqghbc0b-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
6 pass
0 fail
8 expect() calls
Ran 6 tests across 1 file.
```

### Production data unchanged

Before and after all PXL-17 verification:

```text
audit_event|56
project|30
task|17
task_deliverable|27
```

Diff between before and final production counts: empty.

### Test database reset proof

```text
bun run db:test:reset
Resetting test database (truncating tables, keeping schema)...
DO
✅ Test database reset.

test public table count after reset: 43
test _prisma_migrations rows after reset: 3
test data rows after reset:
audit_event|0
project|0
task|0
task_deliverable|0
```

## 7. Known Gaps / Deferred

- CI is not wired yet. Future CI must store `TEST_DATABASE_URL` as a secret and run the same package scripts.
- No automatic fixture seeding exists after `db:test:reset`; tests that need data must create it explicitly in the test branch.
- The test branch is long-lived. If it accumulates drift, rotate it from production main and re-run this verification.
- Existing tests still include destructive setup patterns. They are allowed only because the test database is isolated; they should still be cleaned up over time.

## 8. References

- Linear: PXL-17
- Incident log: `/Users/bizman247/.openclaw/workspace/memory/2026-05-29.md` — “The Test Database Incident”
- Guardrails: `/Users/bizman247/.openclaw/workspace/AGENTS.md` Hard Rules 7-11
- Verification checklist: `/Users/bizman247/.openclaw/workspace/VERIFICATION.md` — “The May 29 Lesson — Test Database Isolation”
