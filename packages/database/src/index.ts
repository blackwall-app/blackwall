import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { dbEnv } from "./env";
import { relations } from "./relations";
import * as schema from "./schema";

const client = new Database(dbEnv.DATABASE_URL);
client.run("PRAGMA journal_mode = WAL;");

const db = drizzle({
  client,
  schema,
  relations,
  casing: "snake_case",
});

const dbSchema = schema;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { db, dbSchema, client, type DbTransaction };

// Re-export everything from schema for convenience
export * from "./schema";
export { relations } from "./relations";
