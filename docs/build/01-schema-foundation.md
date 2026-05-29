# 01 — Schema Foundation: PXL-4 Audit + PXL-5a Migration/Drift Fix

## 1. What

Added three agent-layer tables (`ApiKey`, `TaskDeliverable`, `AuditEvent`), eight Project/Task columns, and a safe baseline migration for the pre-existing Neon schema after Prisma drift was discovered.

In plain English: Pexlo Portal already had project/task/client-portal data, but it did not have the database foundation for AI agents to write safely, retry idempotently, attach deliverables to tasks, or leave a general audit trail. PXL-5a added that foundation and cleaned up the migration history without wiping the existing CSP/demo data.

## 2. Why

The PXL-4 audit found that the schema was UI-first, not agent/R&D-first. It could support a nice portal, but it was missing the backend contract for agent-driven project execution.

Specific gaps:

- **AI agents cannot authenticate with browser cookies.** Omni/Crank need server-to-server credentials, not Better Auth browser sessions. That requires API keys scoped to an organization.
- **The existing audit model was too narrow.** `ActivityLog` exists, but it mainly covers document/decision events. It is not a general mutation history for projects, tasks, time entries, deliverables, or agent actions.
- **Task outputs were not first-class.** Files existed, project updates existed, and documents existed, but there was no task-level deliverable model for PDFs, screenshots, links, generated reports, or other outputs.
- **Task completion semantics were muddy.** `closedAt` existed on `Task`, but it is tied to decision-task closure. Normal tasks needed `completedAt`.
- **Agent retries need idempotency.** Agents will retry. Without `externalId` scoped to an organization, duplicate project/task creation becomes likely.
- **Source/provenance matters.** We need to know whether a project/task came from web UI, agent, system import, or some future integration.
- **Client visibility needs a database flag.** CSP needs client-safe status views. Not every internal task or deliverable should be client-visible.
- **The database had drifted from migrations.** Neon contained 39 application tables, but the repo initially had no baseline migration for them and Neon had no `_prisma_migrations` table. That had to be fixed before applying new migrations safely.

## 3. Considered & Rejected

### Add R&D/QRE fields immediately

Deferred. The audit recommended fields like `qreEligible`, `qreCategory`, `technicalNarrative`, `internalDescription`, and related substantiation fields. They are important, but adding them in PXL-5a would have widened the migration and delayed the CSP invoice/status use case. Phase 1 needed the minimal agent foundation: auth, idempotent references, deliverables, audit events, visibility, and completion timestamps.

### Add soft delete now

Deferred. `deletedAt` is still needed for Project/Task because hard deletes are bad for substantiation. It was not required to unlock the agent API layer, so it stayed in the Phase 2 backlog.

### Use `prisma migrate reset` to fix drift

Rejected. Prisma detected drift and wanted a reset path during migration development. Resetting the Neon `public` schema would have wiped existing CSP/demo data. Existing data smoke tests showed `users=2`, `orgs=1`, `projects=1`. Wiping that to make Prisma happy would have been lazy and wrong.

### Use `prisma db push` to bring the database in line

Rejected. The drift category was “schema ahead of migrations”: Neon already had app tables without migration history. `db push` is likely how a schema gets into this state in the first place. Future changes need migration files, reviewable SQL, and `_prisma_migrations` history.

### Manually apply SQL through `psql`

Rejected for the normal path. Manual `psql` can be appropriate for carefully authorized repairs, but it would create more drift if not paired with migration history. PXL-5a used Prisma migration history: baseline marked as applied, then agent migration deployed.

### Hand-write a baseline migration

Rejected. The safer route was `prisma db pull --print` plus `prisma migrate diff --from-empty` to generate a baseline from the actual existing Neon schema. Humans are bad at reconstructing 39-table schemas by hand. Let the tool describe the current database, then review the SQL.

## 4. What We Built

### Files and migrations

- `packages/database/prisma/schema.prisma`
  - Added `ApiKey`, `TaskDeliverable`, `AuditEvent` models.
  - Added Project fields: `slug`, `completedAt`, `externalId`, `source`.
  - Added Task fields: `completedAt`, `externalId`, `source`, `clientVisible`.
  - Added relations from `Organization`, `User`, and `Task` where required.
- `packages/database/prisma/migrations/20260529110000_baseline_existing_neon_schema/migration.sql`
  - 970-line baseline migration generated from the existing Neon schema.
  - Captures the pre-existing 39 application tables and `file_type` enum.
  - Marked as applied with zero applied steps; it was not run against existing tables.
- `packages/database/prisma/migrations/20260529111100_add_agent_layer_minimal/migration.sql`
  - 119-line additive migration for the agent layer.
  - Adds 3 new tables, 8 Project/Task columns, unique indexes, secondary indexes, and 7 foreign keys.

### New model: `ApiKey`

Purpose: server-to-server authentication for Omni/Crank and future internal agents. API keys are scoped to an organization, stored as hashes, and revocable.

```prisma
model ApiKey {
  id             String    @id @default(cuid())
  organizationId String
  name           String
  keyHash        String    @unique
  keyPrefix      String
  scopes         String[]
  lastUsedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdById    String?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy    User?        @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([keyHash])
  @@map("api_key")
}
```

Field rationale:

- `keyHash`: store only the hash, never the bearer token.
- `keyPrefix`: safe display/debug value for “which key was used?”
- `scopes`: supports least-privilege contracts like `projects:write`, `tasks:write`, `deliverables:write`.
- `lastUsedAt` / `revokedAt`: basic operational lifecycle.
- `createdById`: ties key creation back to a human when available.

### New model: `TaskDeliverable`

Purpose: attach task-level outputs: links, uploaded files, screenshots, PDFs, generated reports, or future document artifacts.

```prisma
model TaskDeliverable {
  id             String    @id @default(cuid())
  taskId         String
  organizationId String
  title          String
  description    String?
  type           String    @default("link")
  fileId         String?
  url            String?
  clientVisible  Boolean   @default(true)
  createdById    String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  task         Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  file         File?        @relation(fields: [fileId], references: [id], onDelete: SetNull)
  createdBy    User?        @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([taskId])
  @@index([organizationId])
  @@index([fileId])
  @@map("task_deliverable")
}
```

Field rationale:

- `taskId`: deliverables are tied to the work item that produced them.
- `organizationId`: makes tenant scoping cheap and explicit.
- `type`: flexible string for `link`, `file`, `document`, `screenshot`, `pdf`, etc.
- `fileId` / `url`: supports both managed files and external links.
- `clientVisible`: prevents internal-only artifacts from leaking into the client status view.

### New model: `AuditEvent`

Purpose: general immutable-ish event trail for agent/web/system mutations.

```prisma
model AuditEvent {
  id             String    @id @default(cuid())
  organizationId String
  entityType     String
  entityId       String
  action         String
  actorType      String
  actorId        String?
  source         String?
  before         Json?
  after          Json?
  metadata       Json?
  createdAt      DateTime  @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, entityType, entityId, createdAt])
  @@index([organizationId, createdAt])
  @@map("audit_event")
}
```

Field rationale:

- `entityType` / `entityId`: generic enough for projects, tasks, time entries, deliverables, documents, and future agent runs.
- `action`: `created`, `updated`, `status_changed`, `deleted`, `restored`, etc.
- `actorType` / `actorId`: distinguish user, API key, agent, and system actions.
- `source`: web, agent, import, system.
- `before` / `after`: diff context for debugging and substantiation.
- `metadata`: request IDs, external IDs, Linear issue keys, idempotency keys, model names, or job IDs.

### Project and Task additions

`Project` gained:

- `slug` — future client-friendly URL identifier; unique with `organizationId`.
- `completedAt` — actual completion timestamp.
- `externalId` — idempotent agent/import reference; unique with `organizationId`.
- `source` — provenance such as web, agent, import, or system.

`Task` gained:

- `completedAt` — normal task completion timestamp, separate from decision `closedAt`.
- `externalId` — idempotent agent/import reference; unique with `organizationId`.
- `source` — provenance.
- `clientVisible` — first visibility flag for read-only/client-safe surfaces.
- `deliverables` relation — task-level artifacts.

### Constraints and indexes

Agent-layer migration added:

- 7 foreign keys:
  - `api_key.organizationId -> organization.id`
  - `api_key.createdById -> user.id`
  - `task_deliverable.taskId -> task.id`
  - `task_deliverable.organizationId -> organization.id`
  - `task_deliverable.fileId -> file.id`
  - `task_deliverable.createdById -> user.id`
  - `audit_event.organizationId -> organization.id`
- Unique indexes:
  - `api_key.keyHash`
  - `project(organizationId, slug)`
  - `project(organizationId, externalId)`
  - `task(organizationId, externalId)`
- Lookup indexes for tenant, task, file, and audit queries.

## 5. How to Extend

### Adding a new field to `Project` or `Task`

1. Edit `packages/database/prisma/schema.prisma`.
2. From `packages/database`, generate a migration:

```bash
cd ~/Projects/pexlo-portal/packages/database
bun run db:migrate --name <descriptive-name>
```

3. Review the generated SQL. Look for accidental drops, table rewrites, or unexpected nullability changes.
4. Apply to shared Neon with deploy semantics:

```bash
bunx prisma migrate deploy --schema prisma/schema.prisma
```

5. Verify with Prisma status and direct SQL:

```bash
bunx prisma migrate status --schema prisma/schema.prisma
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1
```

6. Update this build doc or create the next numbered doc in `docs/build/`.

If Prisma asks to reset the schema, stop and investigate drift. Do not reset shared Neon to unblock yourself.

### Adding a new model

Use the same flow, plus relation hygiene:

- Add both sides of Prisma relations where needed.
- Decide tenant boundary: most app models should include `organizationId`.
- Decide delete behavior explicitly (`Cascade`, `SetNull`, or restrict by application code).
- Add indexes for common access paths.
- Add a client-visibility decision if the model can ever appear in `/portal/*`.
- If agents mutate it, write `AuditEvent` rows from the service layer.

### Future Phase 2 fields

From the PXL-4 gap analysis, likely next fields include:

- R&D/substantiation: `qreEligible`, `qreCategory`, `technicalNarrative`, `internalDescription`, `qreNotes`, `technicalUncertainty`, `experimentationNarrative`.
- Planning: `estimatedMinutes`, possibly `estimateSource`.
- Status semantics: `blockedReason`, `progressOverride`, clearer blocked/cancelled status vocabulary.
- Date semantics: rename or re-express `endDate` as target date in API responses; avoid confusing target dates with actual completion.
- Durability: `deletedAt` for Project/Task and likely updates/notes later.
- Visibility: broader `visibility` enum/string on updates/files/comments/deliverables if boolean becomes too weak.

## 6. Verification

### Migration history

```text
Prisma status:        Database schema is up to date
Migration history:    2 rows
Baseline migration:   20260529110000_baseline_existing_neon_schema — applied_steps_count=0, finished=true
Agent migration:      20260529111100_add_agent_layer_minimal — applied_steps_count=1, finished=true
```

### Database object checks

```text
New tables:           3/3  (api_key, audit_event, task_deliverable)
Project new columns:  4/4  (completedAt, externalId, slug, source)
Task new columns:     4/4  (clientVisible, completedAt, externalId, source)
Foreign keys added:   7/7
Data integrity:       users=2 orgs=1 projects=1  (unchanged from pre-fix smoke test)
Commits on branch:    89c98ca (schema) + 6632593 (baseline) — pushed
Pre-fix safety branch: br-lively-mountain-aqi66e28 (Neon)
```

Actual verification query results from `packages/database`:

```text
check         value
migrations   2
new_tables   3
project_cols 4
task_cols    4
foreign_keys 7
users        2
orgs         1
projects     1
```

Migration row detail:

```text
20260529110000_baseline_existing_neon_schema  applied_steps_count=0  finished=true
20260529111100_add_agent_layer_minimal        applied_steps_count=1  finished=true
```

Commands used:

```bash
cd ~/Projects/pexlo-portal/packages/database
bunx prisma migrate status --schema prisma/schema.prisma
psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1
```

## 7. Known Gaps / Deferred

- R&D/QRE fields are not added yet. Phase 2 should add the substantiation fields after the agent API and CSP status path are unblocked.
- No `deletedAt` soft delete on Project/Task yet.
- `ActivityLog` is not deprecated. It lives alongside `AuditEvent` and still covers older document/decision timeline behavior.
- No API guard or `/api/agent/*` endpoints exist yet. `ApiKey` is only the schema foundation.
- No idempotency table exists. PXL-5a relies on `externalId` uniqueness for the first idempotency layer.
- `apps/api` lint script references `eslint`, which is not installed/found. That repo/tooling issue is backlogged as PXL-14.
- A stale duplicate Neon project was deleted during cleanup. Backup retained at `~/Projects/pexlo-portal/backups/stale-Pexlo-Portal-nameless-tree-92382652-2026-05-29.sql.gz` until the 2026-06-03 cleanup reminder.
- The baseline migration has 970 lines because it represents the full existing database. That is expected. Do not try to “simplify” it unless rebuilding migration history deliberately.

## 8. References

- Linear PXL-4: https://linear.app/mastermind365/issue/PXL-4/audit-existing-pexlo-portal-projecttask-schema-identify-gaps
- Linear PXL-5: https://linear.app/mastermind365/issue/PXL-5/build-pexlo-portal-ai-agent-tool-service-account-api
- Linear project: https://linear.app/mastermind365/project/pexlo-portal-ai-agent-projecttask-layer-c4a2bf078e60
- Audit doc: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-audit-2026-05-29.md`
- Drift fix plan: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-drift-fix-plan-2026-05-29.md`
- Pre-fix Neon branch doc: `/Users/bizman247/.openclaw/workspace/memory/research/pexlo-portal-pre-fix-branch-2026-05-29.md`
- R&D tax credit notes: `/Users/bizman247/.openclaw/workspace/memory/research/rd-tax-credit-program-2026-05-29.md`
- Schema commit: `89c98ca`
- Baseline/drift-fix commit: `6632593`
