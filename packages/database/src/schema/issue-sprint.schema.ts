import { randomUUIDv7 } from "bun";
import { index, integer, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps } from "../utils";
import { user } from "./auth.schema";
import { team } from "./team.schema";

export const issueSprintStatusValues = ["planned", "active", "completed"] as const;
export type IssueSprintStatus = (typeof issueSprintStatusValues)[number];

export const issueSprint = sqliteTable(
  "issue_sprint",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    createdById: text("created_by_id")
      .notNull()
      .references((): AnySQLiteColumn => user.id),
    name: text().notNull(),
    goal: text(),
    teamId: text("team_id")
      .notNull()
      .references((): AnySQLiteColumn => team.id),
    startDate: integer({
      mode: "timestamp_ms",
    }).notNull(),
    endDate: integer({
      mode: "timestamp_ms",
    }).notNull(),
    status: text({ enum: issueSprintStatusValues }).notNull().default("planned"),
    finishedAt: integer({
      mode: "timestamp_ms",
    }),
    archivedAt: integer("archived_at", {
      mode: "timestamp_ms",
    }),
    ...lifecycleTimestamps,
  },
  (table) => [
    index("issue_sprint_created_by_id_idx").on(table.createdById),
    index("issue_sprint_team_id_idx").on(table.teamId),
    index("issue_sprint_team_archived_created_idx").on(
      table.teamId,
      table.archivedAt,
      table.createdAt,
    ),
  ],
);

export type IssueSprint = typeof issueSprint.$inferSelect;
export type NewIssueSprint = typeof issueSprint.$inferInsert;
export type SerializedIssueSprint = JSONParsed<IssueSprint>;
