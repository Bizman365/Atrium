-- Add idempotency fields to agent-created task deliverables.
ALTER TABLE "task_deliverable"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "source" TEXT;

ALTER TABLE "task_deliverable"
ADD CONSTRAINT "task_deliverable_organizationId_externalId_key" UNIQUE ("organizationId", "externalId");
