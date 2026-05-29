# 00 — Pexlo Portal Architecture Overview

## 1. What

Pexlo Portal is a multi-tenant project/task management portal where Pexlo's AI agents can write project work through an API and clients, starting with City Safe Partners, can view project status and work history through a branded portal.

The product is not being invented from a blank page. It is the existing Atrium monorepo, rebranded into Pexlo Portal, with a real project/task/client portal base already in place. The current build turns that base into an agent-operable, client-facing system of record.

## 2. Why

Pexlo needed a client-facing layer that can show project status, tasks, deliverables, and work history without forcing clients into internal tools. The immediate use case is CSP: Chris needs a way to show what Pexlo is building, what is done, what is pending, and what artifacts were delivered.

The second reason is substantiation. The R&D tax credit research notes from 2026-05-29 are blunt: the credit is document-driven. Strong files include project lists/business components, technical narratives, time tracking by project, cost tracking, engineering artifacts, and commit/test history. Pexlo Portal should make that evidence a byproduct of the work instead of a painful reconstruction exercise months later.

So the portal has two jobs:

1. Replace “trust me, work is happening” with client-visible receipts.
2. Replace scattered engineering evidence with an auditable project/task trail that can support §41 R&D credit and §174A domestic software development documentation, subject to CPA review.

## 3. Considered & Rejected

### Linear as the client portal

Rejected. Linear is excellent as an internal execution tool, but it is not a client portal. It is not white-labeled around Pexlo/CSP, it exposes too much internal operational detail, and it does not cleanly separate client-safe status from internal engineering chatter. Linear remains the planning/tracking backbone for PXL work, not the customer-facing layer.

### Notion as the client portal

Rejected. Notion can make attractive pages quickly, but it is weak as an agent-write target and weak as an audit system. It does not give us the API contract, idempotency controls, database constraints, or service-layer audit events we need for Omni/Crank writing directly into the system. It would also create another place for project truth to drift.

### Build from scratch with no existing schema

Rejected. The repo already had Project, Task, ProjectClient, ProjectUpdate, ProjectStatus, ProjectLabel, ProjectNote, file upload, document, invoice, time-entry, and portal functionality from earlier Atrium work. Throwing that away would waste working code and delay the CSP invoice/status use case. The right move is to harden the existing base and add the missing agent/audit layer.

## 4. What We Built / What Exists Now

The current repo is an Atrium-origin monorepo using Bun, Turborepo, Next.js, Nest-style API code, Prisma, and Neon Postgres. It has been rebranded as Pexlo Portal at the user-facing layer, but package names still use `@atrium/*` internally.

Key existing capabilities from the audit:

- Multi-tenant organizations and members through Better Auth tables and organization models.
- Project records with status, dates, clients, files, updates, tasks, invoices, notes, labels, documents, activity logs, and time entries.
- Client assignment through `ProjectClient`.
- Client portal routes under `/portal/*`.
- Project detail data for assigned clients through `/projects/mine/:id`.
- Updates, comments, file uploads, document actions, invoice actions, decision tasks, and task request flows.
- Time tracking linked to projects/tasks with reporting and invoice generation.
- Branding/custom logo support for portal/dashboard surfaces.

That existing surface is richer than a static status page. Clients can currently post updates, create request tasks, upload files, vote on decisions, comment, sign/approve documents, and pay invoices. Good product base; wrong default for CSP-style read-only reporting.

## 5. What We're Adding

The PXL project is adding three layers on top of the existing portal:

1. **Agent write API** — server-to-server endpoints for Omni/Crank to create/update projects and tasks, attach deliverables, write time, and sync statuses without browser cookies.
2. **Client read-only status view** — a tighter CSP-style view that shows summary, tasks/milestones, deliverables, and recent updates without exposing internal controls or mutation buttons.
3. **Audit trail** — every agent mutation should produce an `AuditEvent` with entity, action, actor, source, before/after JSON, and metadata. This is required for debugging, client trust, and R&D/legal substantiation.

PXL-5a delivered the first database layer for this: `ApiKey`, `TaskDeliverable`, `AuditEvent`, plus project/task fields for slugs, external IDs, source, visibility, and completion timestamps. PXL-5 still owns the API endpoint implementation.

## 6. Stack, Repos, and Key Files

### Stack

- Runtime/package manager: Bun
- Monorepo orchestration: Turborepo
- Web: Next.js in `apps/web`
- API: Nest-style API in `apps/api`
- Database ORM: Prisma in `packages/database`
- Database: Neon Postgres
- Auth: Better Auth tables plus app-level organization/member models
- File storage: R2-backed upload/file infrastructure already present in the product
- Shared code: `packages/shared`
- Email package: `packages/email`

### Repo layout

- `apps/api` — API services/controllers. Future `/api/agent/*` work lands here.
- `apps/web` — dashboard and portal UI, including `/portal/*` client surfaces.
- `packages/database` — Prisma schema, migrations, generated client, seed/RLS scripts.
- `packages/shared` — shared constants/types used by web/API.
- `packages/email` — email-related package.

### Linear

- Team key: `PXL`
- Project: `Pexlo Portal — AI-Agent Project/Task Layer`
- Project URL: https://linear.app/mastermind365/project/pexlo-portal-ai-agent-projecttask-layer-c4a2bf078e60

## 7. How to Extend

### Migration discipline

Every database change goes through Prisma migrations. Do not use `db push` against shared Neon. Do not manually apply ad hoc SQL unless there is an explicit repair plan and a corresponding migration-history decision.

Default flow:

```bash
cd ~/Projects/pexlo-portal/packages/database
# Edit prisma/schema.prisma first
bun run db:migrate --name <descriptive-name>
# Review generated SQL
bunx prisma migrate deploy --schema prisma/schema.prisma
bunx prisma migrate status --schema prisma/schema.prisma
```

For shared/prod-like Neon, deploy with `migrate deploy`, not a dev reset. If Prisma asks to reset the schema, stop. That is drift, not permission to wipe data.

### Test database isolation rule

Tests must never use production `DATABASE_URL`. The repo now has a long-lived Neon `test` branch, `TEST_DATABASE_URL`, package-script preflight checks, and Bun test preload guards. Use the documented pattern in [`05-test-isolation.md`](./05-test-isolation.md) before running any test command.

### Agent mutation rule

Every agent/API-key write should write an `AuditEvent`. At minimum:

- `organizationId`
- `entityType`
- `entityId`
- `action`
- `actorType` (`api_key`, `agent`, `system`, or `user`)
- `actorId`
- `source` (`agent`, `web`, `system`, `import`)
- `before` / `after` JSON where useful
- `metadata` for request IDs, external IDs, idempotency keys, or Linear references

### Client visibility rule

Every client-facing field or new relation needs an explicit visibility decision. The first schema layer added `Task.clientVisible` and `TaskDeliverable.clientVisible`. Future updates/files/comments should not accidentally leak internal notes, R&D narratives, rates, time entries, or non-client artifacts.

### Status/read-only view rule

Do not overload the collaborative portal page with accidental read-only conditionals everywhere. Prefer a dedicated status route that reuses components where safe but has its own server response and no mutation controls.

## 8. Verification

Current verified database state after PXL-5a drift fix:

```text
Prisma migrate status: Database schema is up to date
Migration rows:        2
New agent tables:      3/3  (api_key, audit_event, task_deliverable)
Project new columns:   4/4  (completedAt, externalId, slug, source)
Task new columns:      4/4  (clientVisible, completedAt, externalId, source)
Agent foreign keys:    7/7
Existing data smoke:   users=2 orgs=1 projects=1
```

Verification command used from `packages/database`:

```bash
bunx prisma migrate status --schema prisma/schema.prisma
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1
```

Migration history:

```text
20260529110000_baseline_existing_neon_schema  applied_steps_count=0  finished=true
20260529111100_add_agent_layer_minimal        applied_steps_count=1  finished=true
```

## 9. Known Gaps / Deferred

- PXL-5 API endpoints are still pending. The schema exists; the service-account API does not yet.
- The current client portal is collaborative, not read-only. CSP-style status view is future work.
- R&D/QRE-specific task fields are deferred to Phase 2.
- Soft delete is not added to Project/Task yet.
- `ActivityLog` still exists alongside `AuditEvent`; it has not been deprecated or migrated.
- `apps/api` lint script references `eslint`, which is not installed/found. This is tracked separately as PXL-14.
- Test database isolation is now mandatory. Direct `bun test` without `TEST_DATABASE_URL` aborts; see `05-test-isolation.md`.
- The repo still has internal `atrium` package names. User-facing branding is Pexlo Portal, but package rename is not part of this build.

## 10. References

- Linear project: https://linear.app/mastermind365/project/pexlo-portal-ai-agent-projecttask-layer-c4a2bf078e60
- PXL-4: https://linear.app/mastermind365/issue/PXL-4/audit-existing-pexlo-portal-projecttask-schema-identify-gaps
- PXL-5: https://linear.app/mastermind365/issue/PXL-5/build-pexlo-portal-ai-agent-tool-service-account-api
- Audit doc: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-audit-2026-05-29.md`
- Drift fix plan: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-drift-fix-plan-2026-05-29.md`
- Pre-fix branch doc: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-pre-fix-branch-2026-05-29.md`
- R&D research notes: `/Users/bizman247/.openclaw/workspace/memory/research/rd-tax-credit-program-2026-05-29.md`
- Schema commit: `89c98ca`
- Baseline/drift-fix commit: `6632593`
- Test isolation build doc: `docs/build/05-test-isolation.md`
