import { randomUUIDv7 } from "bun";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps, sqliteTable } from "../utils";
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
    createdById: text()
      .notNull()
      .references(() => user.id),
    name: text().notNull(),
    goal: text(),
    teamId: text()
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
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
    archivedAt: integer({
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
    uniqueIndex("issue_sprint_one_active_per_team")
      .on(table.teamId)
      .where(sql`${table.status} = 'active'`),
    // Target for the composite foreign key that keeps an issue's sprint inside the issue's team.
    unique("issue_sprint_id_team_id_unique").on(table.id, table.teamId),
    check(
      "issue_sprint_finished_at_matches_status",
      sql`(${table.status} = 'completed') = (${table.finishedAt} is not null)`,
    ),
  ],
);

export type IssueSprint = typeof issueSprint.$inferSelect;
export type NewIssueSprint = typeof issueSprint.$inferInsert;
export type SerializedIssueSprint = JSONParsed<IssueSprint>;
