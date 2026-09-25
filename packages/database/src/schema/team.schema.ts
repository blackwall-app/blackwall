import { randomUUIDv7 } from "bun";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps } from "../utils";
import { user } from "./auth.schema";
import { workspace } from "./workspace.schema";

export const team = sqliteTable(
  "team",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    name: text().notNull(),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    key: text().notNull(),
    avatar: text(),
    ...lifecycleTimestamps,
  },
  (table) => [
    uniqueIndex("team_workspace_id_key_unique")
      .on(table.workspaceId, table.key)
      .where(sql`${table.deletedAt} is null`),
    // Target for composite foreign keys that pin child rows to the team's workspace.
    unique("team_id_workspace_id_unique").on(table.id, table.workspaceId),
  ],
);

/**
 * Keys a team used before it was renamed, so links like `OLD-12` keep resolving.
 * A key stops being an alias as soon as a team in the workspace claims it again.
 */
export const teamKeyAlias = sqliteTable(
  "team_key_alias",
  {
    workspaceId: text().notNull(),
    key: text().notNull(),
    teamId: text().notNull(),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$default(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.key] }),
    index("team_key_alias_team_id_idx").on(table.teamId),
    foreignKey({
      columns: [table.teamId, table.workspaceId],
      foreignColumns: [team.id, team.workspaceId],
    }).onDelete("cascade"),
  ],
);

export const userTeam = sqliteTable(
  "user_on_team",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    teamId: text()
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
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
export type TeamKeyAlias = typeof teamKeyAlias.$inferSelect;
export type SerializedTeam = JSONParsed<Team>;
