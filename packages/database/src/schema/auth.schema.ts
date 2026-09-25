import type { User as BetterAuthUserType } from "better-auth";
import { randomUUIDv7 } from "bun";
import { index, integer, text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "../utils";
import { team } from "./team.schema";
import { workspace } from "./workspace.schema";

export const user = sqliteTable(
  "user",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: integer({ mode: "boolean" }).default(false),
    image: text(),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
    lastWorkspaceId: text().references(() => workspace.id, { onDelete: "set null" }),
    lastTeamId: text().references(() => team.id, { onDelete: "set null" }),
    preferredTheme: text({
      enum: ["system", "light", "dark"],
    }).default("system"),
    preferredLocale: text({
      enum: ["en", "pl"],
    }),
  },
  (table) => [
    index("user_last_workspace_id_idx").on(table.lastWorkspaceId),
    index("user_last_team_id_idx").on(table.lastTeamId),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    accessTokenExpiresAt: integer({
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer({
      mode: "timestamp_ms",
    }),
    scope: text(),
    idToken: text(),
    password: text(),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable("verification", {
  id: text()
    .primaryKey()
    .$defaultFn(() => randomUUIDv7()),
  identifier: text().notNull().unique(),
  value: text().notNull(),
  expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
  createdAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

import type { JSONParsed } from "hono/utils/types";

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type BetterAuthUser = BetterAuthUserType;

export type SerializedUser = JSONParsed<User>;
