import { randomUUIDv7 } from "bun";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobStatusValues = ["pending", "processing", "completed", "failed"] as const;
export type JobStatus = (typeof jobStatusValues)[number];

export const job = sqliteTable(
  "job",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    queue: text().notNull().default("default"),
    type: text().notNull(),
    payload: text().notNull(),
    status: text({ enum: jobStatusValues }).notNull().default("pending"),
    attempts: integer().notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: integer("run_at", { mode: "timestamp_ms" }),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$default(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("job_queue_status_run_at_idx").on(table.queue, table.status, table.runAt),
    index("job_status_locked_until_idx").on(table.status, table.lockedUntil),
  ],
);

export type Job = typeof job.$inferSelect;
export type NewJob = typeof job.$inferInsert;
