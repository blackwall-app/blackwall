import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { client, db } from "@blackwall/database";

type SqliteTableRow = { name: string };

async function resetTestDatabase() {
  const rows = client
    .query("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as SqliteTableRow[];
  const tables = rows
    .map((row) => row.name)
    .filter((name) => name !== "__drizzle_migrations" && name !== "sqlite_sequence");

  client.run("PRAGMA foreign_keys = OFF;");
  for (const table of tables) {
    client.run(`DELETE FROM "${table}";`);
  }
  client.run("PRAGMA foreign_keys = ON;");
}

/**
 * Creates an in-memory SQLite database for testing
 */
export async function createTestDb() {
  await resetTestDatabase();
  migrate(db, {
    migrationsFolder: process.env.MIGRATIONS_DIR ?? "./migrations",
  });

  return { db, client };
}

/**
 * Type for test database
 */
export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/**
 * Cleans up test database
 */
export function cleanupTestDb(testDb: TestDb) {
  testDb.client.run("PRAGMA foreign_keys = OFF;");
  testDb.client.run("PRAGMA foreign_keys = ON;");
}
