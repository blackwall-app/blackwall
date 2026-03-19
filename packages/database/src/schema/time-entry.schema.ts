import { randomUUIDv7 } from "bun";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { lifecycleTimestamps } from "../utils";
import { user } from "./auth.schema";
import { issue } from "./issue.schema";

export const timeEntry = sqliteTable(
  "time_entry",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    duration: integer().notNull(),
    description: text(),
    ...lifecycleTimestamps,
  },
  (table) => [
    index("time_entry_issue_id_idx").on(table.issueId),
    index("time_entry_user_id_idx").on(table.userId),
    index("time_entry_issue_deleted_created_idx").on(
      table.issueId,
      table.deletedAt,
      table.createdAt,
    ),
  ],
);

export type TimeEntry = typeof timeEntry.$inferSelect;
export type NewTimeEntry = typeof timeEntry.$inferInsert;

export const timeEntrySelectSchema = createSelectSchema(timeEntry);
export const timeEntryInsertSchema = createInsertSchema(timeEntry);
export const timeEntryUpdateSchema = createUpdateSchema(timeEntry);
