// Bun test preload guard. This runs inside `bun test`, including direct test invocations
// that bypass package.json scripts.

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error("❌ ABORT: TEST_DATABASE_URL is not set. Tests refuse to run.");
  console.error("   Use package test scripts or source packages/database/.env.test first.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("❌ ABORT: DATABASE_URL is not set for test execution.");
  console.error("   Tests must run with DATABASE_URL=$TEST_DATABASE_URL.");
  process.exit(1);
}

if (databaseUrl !== testDatabaseUrl) {
  console.error("❌ ABORT: DATABASE_URL is not pointing at TEST_DATABASE_URL during bun test.");
  console.error("   Refusing to let tests touch a non-test database.");
  process.exit(1);
}

if (!testDatabaseUrl.includes("neon.tech")) {
  console.warn("⚠️  TEST_DATABASE_URL doesn't look like a Neon URL. Continuing anyway.");
}

const masked = testDatabaseUrl.replace(/(\/\/[^:]+):[^@]+@/, "$1:****@");
console.log(`✅ Bun test DB target: ${masked}`);
