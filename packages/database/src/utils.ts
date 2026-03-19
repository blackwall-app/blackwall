import * as sqlite from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const lifecycleTimestamps = {
  createdAt: sqlite
    .integer({ mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date()),
  updatedAt: sqlite
    .integer({ mode: "timestamp_ms" })
    .notNull()
    .$default(() => new Date())
    .$onUpdate(() => new Date()),
  deletedAt: sqlite.integer({ mode: "timestamp_ms" }),
};

export const nanoidPk = sqlite.text({ length: 21 }).$default(nanoid).primaryKey();
