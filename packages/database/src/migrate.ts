import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index";

export async function migrateDatabase(migrationsFolder: string) {
  migrate(db, { migrationsFolder });
}
