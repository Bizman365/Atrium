#!/usr/bin/env bun
// Aborts test execution if DB safety conditions aren't met.

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testBranchName = process.env.TEST_DATABASE_BRANCH_NAME;

if (!testDatabaseUrl) {
  console.error("❌ ABORT: TEST_DATABASE_URL is not set. Tests refuse to run.");
  console.error("   See PXL-17 + docs/build/05-test-isolation.md");
  process.exit(1);
}

if (databaseUrl && databaseUrl === testDatabaseUrl) {
  console.error("❌ ABORT: TEST_DATABASE_URL is the same as DATABASE_URL.");
  console.error("   This would wipe production data. Refusing to run.");
  process.exit(1);
}

// Bonus: verify test DB is actually a Neon branch named "test" when metadata is available.
if (!testDatabaseUrl.includes("neon.tech")) {
  console.warn("⚠️  TEST_DATABASE_URL doesn't look like a Neon URL. Continuing anyway.");
}

if (testBranchName && testBranchName !== "test") {
  console.error(`❌ ABORT: TEST_DATABASE_BRANCH_NAME is '${testBranchName}', expected 'test'.`);
  console.error("   Refusing to run tests against a non-test branch.");
  process.exit(1);
}

// Mask credentials in log
const masked = testDatabaseUrl.replace(/(\/\/[^:]+):[^@]+@/, "$1:****@");
console.log(`✅ Test DB target: ${masked}`);
console.log("✅ Pre-flight passed. Tests may proceed.");
