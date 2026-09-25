import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { client, db } from "./index";

/**
 * Applies pending migrations with foreign key enforcement turned off, then checks every
 * foreign key before turning it back on.
 *
 * Drizzle runs migrations inside one transaction, where `PRAGMA foreign_keys` is a no-op.
 * With enforcement on, the `DROP TABLE` in a table rebuild deletes the old rows first and
 * fires `ON DELETE CASCADE` on child tables. The pragma has to be set outside the transaction.
 */
export async function migrateDatabase(migrationsFolder: string) {
  client.run("PRAGMA foreign_keys = OFF;");
  try {
    migrate(db, { migrationsFolder });

    const violations = client.query("PRAGMA foreign_key_check;").all();
    if (violations.length > 0) {
      throw new Error(
        `Migrations left ${violations.length} foreign key violation(s): ${JSON.stringify(violations.slice(0, 10))}`,
      );
    }
  } finally {
    client.run("PRAGMA foreign_keys = ON;");
  }
}
