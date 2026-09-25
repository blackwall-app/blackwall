import * as sqlite from "drizzle-orm/sqlite-core";
import { sqliteTableCreator } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * Table creator with the snake_case casing that used to be configured globally
 * on `drizzle()`. Drizzle v1 scopes casing per table, so every schema table
 * must go through this instead of `sqliteTable` from drizzle-orm.
 */
export const sqliteTable = sqliteTableCreator((name) => name, "snake_case");

export const timestamps = {
  createdAt: sqlite
    .integer({ mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
  updatedAt: sqlite
    .integer({ mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date())
    .$onUpdate(() => new Date()),
};

/**
 * Timestamps for tables whose rows are soft-deleted. Unique indexes on these tables
 * should be partial (`where deleted_at is null`) so a deleted row doesn't block reuse.
 * Tables whose rows are hard-deleted use `timestamps` instead.
 */
export const lifecycleTimestamps = {
  ...timestamps,
  deletedAt: sqlite.integer({ mode: "timestamp_ms" }),
};

export const nanoidPk = sqlite.text({ length: 21 }).$default(nanoid).primaryKey();
