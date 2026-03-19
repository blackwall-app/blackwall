import { randomUUIDv7 } from "bun";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { user } from "./auth.schema";

export const workspace = sqliteTable(
  "workspace",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    slug: text().notNull(),
    displayName: text().notNull(),
    logoUrl: text(),
  },
  (table) => [uniqueIndex("workspace_slug_unique").on(table.slug)],
);

export const workspaceUser = sqliteTable(
  "workspace_user",
  {
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
    }),
    index("workspace_user_user_id_idx").on(table.userId),
  ],
);

export const workspaceInvitation = sqliteTable(
  "workspace_invitation",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    email: text().notNull(),
    token: text().notNull().unique(),
    expiresAt: integer({ mode: "timestamp_ms" }),
  },
  (table) => [
    index("workspace_invitation_workspace_id_idx").on(table.workspaceId),
    index("workspace_invitation_created_by_id_idx").on(table.createdById),
  ],
);

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;
export type WorkspaceInvitation = typeof workspaceInvitation.$inferSelect;
export type SerializedWorkspace = JSONParsed<Workspace>;
