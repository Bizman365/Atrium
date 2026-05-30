-- Add WorkOS user id mapping for AuthKit migration.
-- Pure additive: nullable column + unique index (PostgreSQL allows multiple NULLs).

ALTER TABLE "user" ADD COLUMN "workosUserId" TEXT;

CREATE UNIQUE INDEX "user_workosUserId_key" ON "user"("workosUserId");
