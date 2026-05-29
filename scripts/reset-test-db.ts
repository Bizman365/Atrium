#!/usr/bin/env bun
// Resets the test database. Drops all data but keeps schema.
import { spawnSync } from "child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const testBranchName = process.env.TEST_DATABASE_BRANCH_NAME;

if (!testDatabaseUrl) {
  console.error("❌ TEST_DATABASE_URL not set");
  process.exit(1);
}

if (databaseUrl && databaseUrl === testDatabaseUrl) {
  console.error("❌ TEST_DATABASE_URL is the same as DATABASE_URL");
  console.error("   Refusing to reset a database that may be production.");
  process.exit(1);
}

// Sanity check: never run against anything that isn't a test branch.
// Neon endpoint hostnames do not include branch names, so prefer explicit branch metadata
// from packages/database/.env.test; fall back to URL text for non-Neon setups.
if (testBranchName !== "test" && !testDatabaseUrl.includes("test")) {
  console.error("❌ TEST_DATABASE_URL doesn't identify a 'test' branch");
  console.error("   Set TEST_DATABASE_BRANCH_NAME=test in packages/database/.env.test.");
  process.exit(1);
}

const sql = `
DO $$ DECLARE table_list TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO table_list
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations';

  IF table_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' CASCADE';
  END IF;
END $$;
`;

console.log("Resetting test database (truncating tables, keeping schema)...");
const result = spawnSync("psql", [testDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("❌ Test database reset failed.");
  process.exit(result.status ?? 1);
}

console.log("✅ Test database reset.");
