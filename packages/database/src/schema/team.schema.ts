import { randomUUIDv7 } from "bun";
import { index, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps } from "../utils";
import { user } from "./auth.schema";
import { issueSprint } from "./issue-sprint.schema";
import { workspace } from "./workspace.schema";

export const team = sqliteTable(
  "team",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    name: text().notNull(),
    activeSprintId: text().references(() => issueSprint.id),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id),
    key: text().notNull(),
    avatar: text(),
    ...lifecycleTimestamps,
  },
  (table) => [
    uniqueIndex("team_workspace_id_key_unique").on(table.workspaceId, table.key),
    index("team_active_sprint_id_idx").on(table.activeSprintId),
  ],
);

export const userTeam = sqliteTable(
  "user_on_team",
  {
    userId: text()
      .notNull()
      .references(() => user.id),
    teamId: text()
      .notNull()
      .references(() => team.id),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.teamId],
    }),
    index("user_team_team_id_idx").on(table.teamId),
  ],
);

export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;
export type SerializedTeam = JSONParsed<Team>;
