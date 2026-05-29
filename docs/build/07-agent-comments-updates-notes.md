# 07 — Agent Comments, Project Updates, Internal Notes

## 1. What

Extended the Pexlo Portal agent layer with schema support, nine agent endpoints, client-status rendering, and CSP demo backfill for comments and project updates.

## 2. Why

PXL-7 proved the project/task layer could carry real CSP work, but the client-facing status page still looked static. Agents needed a safe way to attach task comments, publish client-visible project updates, and keep internal project notes without abusing narrower existing models.

Chris approved Option A: add an additive schema migration instead of working around missing fields.

## 3. Considered & Rejected

- **Work around narrower models** — rejected. The existing `comment`, `project_update`, and `project_note` tables did not have the idempotency/source/client visibility fields agents need.
- **Allow agent comments without an author user** — rejected. `Comment.authorId` remains required, so we created `user-pexlo-agent` and use it consistently.
- **Single generic `/messages` endpoint** — rejected. Per-resource endpoints keep scope checks, validation, and UI intent clearer.
- **Real-time notifications via WebSocket** — deferred. This build is about persisted data and client rendering, not live push.
- **Time logging via API** — out of scope. Chris logs manually in the main UI for now.

## 4. What We Built

### Schema

Migration: `20260529153000_extend_comments_updates_notes_for_agents`

- `Comment`: `projectId`, `clientVisible`, `externalId`, `source`, `updatedAt`, `ProjectComments` relation, `@@unique([organizationId, externalId])`, `@@index([projectId])`
- `ProjectUpdate`: `title`, `clientVisible`, `externalId`, `source`, `@@unique([organizationId, externalId])`
- `ProjectNote`: `externalId`, `source`, `updatedAt`, `@@unique([organizationId, externalId])`

Also carried forward PXL-16 migration `20260529124500_add_deliverable_externalid_source` because production/test already had it applied.

### Agent API endpoints

- `POST /api/agent/comments`
- `GET /api/agent/comments`
- `PATCH /api/agent/comments/:id`
- `POST /api/agent/project-updates`
- `GET /api/agent/project-updates`
- `PATCH /api/agent/project-updates/:id`
- `POST /api/agent/project-notes`
- `GET /api/agent/project-notes`
- `PATCH /api/agent/project-notes/:id`

All use `ApiKeyGuard`, existing project read/write scopes, org scoping, idempotency by `externalId`, atomic transactions, and `audit_event` writes.

### UI

Updated PXL-6 client-status route:

- Fetches task comments where `clientVisible=true`
- Fetches project comments where `clientVisible=true`
- Fetches project updates where `clientVisible=true`
- Explicitly does not fetch project notes
- Adds `project-updates-feed.tsx`
- Adds `comments-list.tsx`
- Renders project updates before task list and task comments under each task

### Backfill

Script: `scripts/backfill-csp-comments-updates.ts`

- Posts one task comment per CSP task through the agent API
- Posts project updates for the three CSP agent projects
- Idempotent via `externalId`

## 5. How to Extend

- Add new agent resource groups inside `apps/api/src/agent/` with DTO/controller/service triplets.
- Keep writes idempotent with `externalId` and org-scoped unique constraints.
- Use `AuditService.writeAudit` inside the same transaction as the mutation.
- Keep client-visible fields explicit; never infer public/private from endpoint alone.
- For UI queries, fetch only the client-visible subset and avoid internal-only tables such as `project_note`.

## 6. Verification

### Neon safety branch

- Branch: `pre-pxl-19-schema-2026-05-29`
- ID: `br-icy-glitter-aqs9zn2o`
- Host: `ep-long-frost-aqwvl2ja.c-8.us-east-1.aws.neon.tech`

### Migration safety

Migration SQL additive scan: no `DROP`, `TRUNCATE`, `RENAME`, or `ALTER ... DROP` statements.

Applied to test DB: yes.
Applied to production DB: yes.

Production row counts before and after migration matched:

```text
api_key          2
audit_event      56
organizations    71
projects_agent   3
task_deliverable 27
tasks_agent      13
users            76
```

Schema verification found all 12 new columns across `comment`, `project_update`, and `project_note`.

### Agent user

`user-pexlo-agent | agent@pexlo.local | Pexlo Agent`

### Backfill

```json
{
  "projects": 3,
  "commentsCreated": 13,
  "commentsExisting": 0,
  "updatesCreated": 4,
  "updatesExisting": 0
}
```

Post-backfill production counts:

```text
comments_agent      13
updates_agent       4
project_notes_agent 0
audit_event         73
users               77
```

### Tests

API suite:

```text
682 pass
0 fail
1122 expect() calls
Ran 682 tests across 39 files.
```

## 7. Known Gaps / Deferred

- `portal.pexlo.com` still runs the rollback image; deploy comes after Omni review and PXL-18 entrypoint safety.
- Agent API uses existing `projects:*` scopes for comments/updates/notes because current keys do not yet have narrower scopes.
- Project notes are API-ready but not backfilled and not rendered to clients by design.
- Real-time notifications remain deferred.

## 8. References

- PXL-19 — Agent endpoints: comments, project updates, internal notes + UI rendering
- PXL-5 — Agent API parent layer
- PXL-6 — Client status view
- PXL-7 — CSP backfill that exposed the need
- PXL-16 — Deliverable idempotency/source migration carried forward
- PXL-17 — Test DB isolation guardrails
- PXL-18 — Entrypoint safety, required before deploy
