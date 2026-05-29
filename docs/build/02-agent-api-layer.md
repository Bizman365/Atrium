# 02 — Agent API Layer: PXL-5b ApiKey Auth + Audit Trail

## 1. What

Built the Pexlo Portal agent API layer: scoped bearer API-key auth, eight `/api/agent/*` endpoints for projects/tasks/deliverables/audit, a one-time key creation CLI, mutation audit writes, and tests covering auth plus the happy path.

## 2. Why

PXL-5a created the database foundation. PXL-5b turns it into a usable service-to-service contract for Omni, Crank, and future Pexlo agents.

The portal already had human/browser routes under `/api/projects`, `/api/tasks`, and related modules. Those routes depend on Better Auth cookies, CSRF assumptions, and UI-oriented DTOs. Agents need a separate, stable contract:

- **Server-to-server auth** that does not depend on browser sessions.
- **Org scoping** resolved from the API key, never from request bodies.
- **Idempotent creates** using `externalId` so retries do not duplicate projects/tasks.
- **Audit events on every write** so status automation can be verified later.
- **Uniform response envelopes** for agent callers: `{ ok, data, meta }` or `{ ok:false, error }`.
- **Least-privilege scopes** so future keys can be narrowly delegated.

## 3. Considered & Rejected

### `pxl_live_` prefix vs `pexlo_` or `papi_`

Chose `pxl_live_` because it follows industry-standard secret-token conventions: short product prefix, environment marker, then opaque random material. It leaves room for `pxl_test_` later without changing the mental model. `pexlo_` was too broad and did not distinguish live/test use. `papi_` was compact but less obvious when seen in logs or key-management screens.

### Include `/audit` now vs defer

Included `/api/agent/audit` now. Deferring it would make the first agent integration harder to verify and would weaken the R&D/QRE foundation. Audit visibility is how Omni/Crank can prove that project/task writes happened, which API key made them, and which request ID caused them.

### Manual key creation vs auto-seed

Rejected auto-seeding Omni/Crank keys. Manual creation preserves chain of custody, allows scopes to be chosen at creation time, and builds the rotation muscle early. The CLI prints the raw token once, stores only a SHA-256 hash, and keeps a display prefix for debugging.

### Bearer auth vs OAuth

Rejected OAuth for this phase. The callers are internal service agents, not humans authorizing third-party apps. Bearer API keys are simpler, auditable, revocable, and enough for server-to-server writes. OAuth can be introduced later if Pexlo exposes third-party integrations.

### Per-route scopes vs all-or-nothing keys

Chose per-route scopes. A read-only reporting key should not be able to create deliverables. A task writer should not automatically read audit logs. Scope checks are enforced by `@ApiKeyScopes(...)` metadata in the guard.

## 4. What We Built

### Files

- `apps/api/src/agent/agent.module.ts` — wires the agent controllers/services into Nest.
- `apps/api/src/agent/agent-projects.controller.ts`
- `apps/api/src/agent/agent-projects.service.ts`
- `apps/api/src/agent/agent-tasks.controller.ts`
- `apps/api/src/agent/agent-tasks.service.ts`
- `apps/api/src/agent/agent-deliverables.controller.ts`
- `apps/api/src/agent/agent-deliverables.service.ts`
- `apps/api/src/agent/agent-audit.controller.ts`
- `apps/api/src/agent/agent-audit.service.ts`
- `apps/api/src/agent/guards/api-key.guard.ts`
- `apps/api/src/agent/decorators/api-key-scopes.decorator.ts`
- `apps/api/src/agent/decorators/current-api-key.decorator.ts`
- `apps/api/src/agent/services/api-key.service.ts`
- `apps/api/src/agent/services/audit.service.ts`
- `apps/api/src/agent/dto/*.ts`
- `apps/api/src/agent/guards/api-key.guard.spec.ts`
- `apps/api/src/agent/agent.e2e.spec.ts`
- `scripts/create-api-key.ts`
- `apps/api/src/app.module.ts` — imports `AgentModule`.
- `apps/api/src/common/filters/http-exception.filter.ts` — emits uniform agent error envelopes only for `/api/agent/*`.

### Auth

`ApiKeyGuard` validates `Authorization: Bearer <token>` for all agent routes.

Token format:

```ts
/^pxl_live_[A-Za-z0-9_-]{32}$/
```

Token generation:

```ts
export function generateRawApiKey(): string {
  return `pxl_live_${randomBytes(24).toString("base64url")}`;
}
```

Storage:

```ts
export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function apiKeyDisplayPrefix(token: string): string {
  return token.slice(0, 16);
}
```

Successful auth sets request context:

```ts
request.apiKey = apiKey;
request.organization = { id: apiKey.organizationId };
```

`lastUsedAt` is updated after successful auth unless the key was already touched within 60 seconds.

### Endpoints

All paths below are under the global `/api` prefix.

| Method | Path | Scope | Behavior |
|---|---|---|---|
| `POST` | `/api/agent/projects` | `projects:write` | Create project, idempotent by org-scoped `externalId`. |
| `PATCH` | `/api/agent/projects/:id` | `projects:write` | Update project fields; stamps `completedAt` on transition to `complete`/`completed`/`done`. |
| `GET` | `/api/agent/projects` | `projects:read` | List projects with `clientId`, `status`, `slug`, `limit`, `cursor`. |
| `GET` | `/api/agent/projects/:id` | `projects:read` | Fetch one project with task counts grouped by status. |
| `POST` | `/api/agent/tasks` | `tasks:write` | Create task, idempotent by org-scoped `externalId`, auto-orders per project. |
| `PATCH` | `/api/agent/tasks/:id` | `tasks:write` | Update task fields; stamps `completedAt` on transition to `done`. |
| `POST` | `/api/agent/tasks/:id/deliverables` | `deliverables:write` | Attach a URL/file deliverable to a task; idempotent by org-scoped `externalId`. |
| `GET` | `/api/agent/audit` | `audit:read` | List recent audit events with filters and cursor pagination. |

### Response examples

Create project response:

```json
{
  "ok": true,
  "data": {
    "id": "project_1",
    "name": "Agent Build",
    "status": "not_started",
    "externalId": "linear:PXL-5",
    "source": "agent"
  },
  "meta": { "auditEventId": "audit_1" }
}
```

Idempotent retry response returns HTTP 200 and does not write a second audit row:

```json
{
  "ok": true,
  "data": { "id": "project_1", "externalId": "linear:PXL-5" },
  "meta": { "auditEventId": null }
}
```

Error response on agent routes:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "API key is missing required scope"
  }
}
```

### Audit writes

Every create/update service writes `audit_event` inside the same Prisma transaction as the mutation.

Example helper call:

```ts
await this.audit.writeAudit({
  tx,
  organizationId: apiKey.organizationId,
  apiKey,
  requestId,
  entityType: "task",
  entityId: task.id,
  action: statusChanged ? "status_changed" : "updated",
  before: existing,
  after: task,
});
```

Audit metadata always includes:

```json
{
  "apiKeyPrefix": "pxl_live_abcdefg",
  "request_id": "<x-request-id or generated UUID>"
}
```


### PXL-16 bug fixes

#### Project completion auto-stamp

PXL-7 CSP backfill exposed that projects using the production `project_status.slug = "complete"` did not receive `completedAt`; tasks did because their terminal status is `done`. The schema has no terminal-status flag on `ProjectStatus`, so PXL-16 uses the explicit slug set:

```ts
const PROJECT_COMPLETED_STATUSES = new Set(["complete", "completed", "done"]);
```

Existing CSP backfill rows were deliberately **not** re-stamped in this PR because PXL-16 was instructed not to touch PXL-7 backfill data. The fix applies to new project creates and future status transitions.

#### Deliverable idempotency

PXL-7 also exposed duplicate `task_deliverable` rows when `POST /api/agent/tasks/:id/deliverables` was retried. PXL-16 adds the same idempotency pattern used by projects/tasks:

- `TaskDeliverable.externalId` and `TaskDeliverable.source` fields.
- Unique org-scoped constraint: `task_deliverable_organizationId_externalId_key`.
- Existing-row lookup before create when `externalId` is present.
- `source = "agent"` set by the service for agent-created deliverables.
- No audit event on idempotent retry.
- P2002 unique races mapped to `409 Conflict`.

Migration:

```text
20260529124500_add_deliverable_externalid_source
```

## 5. How to Extend

### Add a new agent endpoint

1. Add a DTO under `apps/api/src/agent/dto/`.
2. Add a service method that accepts `CurrentApiKeyContext` and uses `apiKey.organizationId` for every Prisma query.
3. Add a controller route under `/agent/...` with `@UseGuards(ApiKeyGuard)` inherited from the class.
4. Add `@ApiKeyScopes("newscope:write")` or `@ApiKeyScopes("newscope:read")`.
5. For mutations, wrap the Prisma mutation and `audit.writeAudit()` in one transaction.
6. Return `{ ok: true, data, meta }` from the controller.
7. Add a unit test or e2e path proving auth/scope/org/audit behavior.
8. Update this build doc or create the next numbered build doc.

### Add a new scope

1. Decide the scope string, e.g. `time_entries:write`.
2. Put it on the route with `@ApiKeyScopes("time_entries:write")`.
3. Include the scope when manually creating a key:

```bash
bun run scripts/create-api-key.ts \
  --org <organizationId> \
  --name "Omni Agent" \
  --scopes "projects:read,time_entries:write"
```

No central registry exists yet; keep scope names consistent and document new scopes when introduced.

### Add audit for a new entity

Use `entityType` as a stable lowercase noun (`project`, `task`, `deliverable`, `time_entry`). Store the affected row ID in `entityId`. Use `created`, `updated`, or `status_changed` unless the entity needs a more specific action. Include `before` on updates and `after` on all successful mutations.

## 6. Verification

### Build

Command:

```bash
bun run build
```

Result:

```text
Tasks:    5 successful, 5 total
Cached:   4 cached, 5 total
Time:     4.662s
```

Notes: Web build emitted existing Sentry configuration warnings. The API build passed.

### Agent-focused tests

Command:

```bash
bun run --filter @atrium/api test src/agent
```

Result:

```text
9 pass
0 fail
36 expect() calls
Ran 9 tests across 3 files. [613.00ms]
```

Covered:

- Valid token + matching scope passes.
- Valid token + missing scope returns 403.
- Invalid token returns 401.
- Revoked token returns 401.
- Missing Authorization header returns 401.
- `lastUsedAt` debounce skips writes inside 60 seconds.
- Unit coverage: project create/update with `status="complete"` stamps `completedAt`.
- E2E happy path: project create, idempotent project retry, task create, task done patch, deliverable create, idempotent deliverable retry, audit list.

### Full API test suite

Command:

```bash
bun run --filter @atrium/api test
```

Result:

```text
684 pass
0 fail
1127 expect() calls
Ran 684 tests across 40 files. [12.54s]
```

### E2E assertions from `agent.e2e.spec.ts`

The test verified concrete counts and statuses:

```text
POST /api/agent/projects -> 201, auditEventId audit_1, auditEvents length 1
POST same externalId -> 200, auditEvents length remains 1
POST /api/agent/tasks -> 201, auditEventId audit_2
PATCH /api/agent/tasks/:id status=done -> 200, completedAt set, audit action status_changed
POST /api/agent/tasks/:id/deliverables with externalId -> 201, source agent, auditEvents length 4
POST same deliverable externalId -> 200, same row ID, auditEventId null, auditEvents length remains 4
GET /api/agent/audit -> 200, returned 4 audit events
```

### Endpoint count

Implemented all eight authorized endpoints:

```text
1. POST  /api/agent/projects
2. PATCH /api/agent/projects/:id
3. GET   /api/agent/projects
4. GET   /api/agent/projects/:id
5. POST  /api/agent/tasks
6. PATCH /api/agent/tasks/:id
7. POST  /api/agent/tasks/:id/deliverables
8. GET   /api/agent/audit
```



### PXL-16 migration verification

Command:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X
```

Result:

```text
migration_name                                  | applied
------------------------------------------------+---------
20260529124500_add_deliverable_externalid_source | t

column_name | data_type | is_nullable
------------+-----------+------------
externalId  | text      | YES
source      | text      | YES

conname                                          | contype
-------------------------------------------------+--------
task_deliverable_organizationId_externalId_key   | u
```

Neon safety branch created before migration deploy:

```text
pre-pxl-16-fix-2026-05-29
br-jolly-morning-aqckfyub
```

## 7. Known Gaps / Deferred

- **Rate limiting per API key** — global throttling still exists, but there is no per-key quota/bucket yet.
- **Scope hierarchy/wildcards** — no `projects:*` or admin super-scope yet; route scopes are exact-match.
- **Webhook events** — audit rows are written, but no outbound webhook/event bus exists.
- **R&D QRE fields** — schema and API do not yet expose QRE-specific fields such as technical uncertainty, experimentation notes, or §41 substantiation tags.
- **Central scope registry** — scopes are route metadata and CLI strings today. A typed registry would help once scope count grows.
- **Manual key rotation UI** — keys can be created by CLI and revoked in DB, but there is no dashboard surface yet.

## 8. References

- Linear issue: [PXL-5 — Build Pexlo Portal AI agent/tool service-account API](https://linear.app/mastermind365/issue/PXL-5/build-pexlo-portal-ai-agent-tool-service-account-api)
- Linear issue: PXL-16 — Fix agent API completedAt + deliverable idempotency bugs
- Linear project: <https://linear.app/mastermind365/project/pexlo-portal-ai-agent-projecttask-layer-c4a2bf078e60>
- Schema foundation doc: [`docs/build/01-schema-foundation.md`](./01-schema-foundation.md)
- Branch: `feat/pxl-5a-agent-schema`
- Commit: this document is committed with `feat(api): agent API layer with ApiKey auth + audit trail (PXL-5b)`
