import { randomUUIDv7 } from "bun";
import {
  index,
  integer,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { sqliteTable } from "../utils";
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

export const workspaceRoleValues = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof workspaceRoleValues)[number];

export const workspaceUser = sqliteTable(
  "workspace_user",
  {
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text({ enum: workspaceRoleValues }).notNull().default("member"),
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
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdById: text()
      .notNull()
      .references(() => user.id),
    email: text().notNull(),
    // SHA-256 of the token sent in the invite link. The raw token is never stored.
    tokenHash: text().notNull().unique(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer({ mode: "timestamp_ms" }),
    acceptedById: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$default(() => new Date()),
  },
  (table) => [
    index("workspace_invitation_workspace_id_idx").on(table.workspaceId),
    index("workspace_invitation_created_by_id_idx").on(table.createdById),
  ],
);

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;
export type WorkspaceUser = typeof workspaceUser.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitation.$inferSelect;
export type SerializedWorkspace = JSONParsed<Workspace>;
