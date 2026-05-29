-- Additive schema extension for agent-authored comments, project updates, and internal notes.

ALTER TABLE "comment"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "comment"
  ADD CONSTRAINT "comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "comment_organizationId_externalId_key" ON "comment"("organizationId", "externalId");
CREATE INDEX "comment_projectId_idx" ON "comment"("projectId");

ALTER TABLE "project_update"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "source" TEXT;

CREATE UNIQUE INDEX "project_update_organizationId_externalId_key" ON "project_update"("organizationId", "externalId");

ALTER TABLE "project_note"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "project_note_organizationId_externalId_key" ON "project_note"("organizationId", "externalId");
