import { mkdirSync } from "node:fs";
import path from "node:path";
import { dbEnv } from "../env";

const MIGRATIONS_PATH = path.resolve(import.meta.dirname, "../migrations");

async function main() {
  mkdirSync(path.dirname(dbEnv.DATABASE_URL), { recursive: true });
  const { migrateDatabase } = await import("../migrate");
  await migrateDatabase(MIGRATIONS_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
