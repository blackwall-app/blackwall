import { randomUUIDv7 } from "bun";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { sqliteTable, timestamps } from "../utils";
import { colorKey } from "./color.enum.schema";
import { issue } from "./issue.schema";
import { workspace } from "./workspace.schema";

export const label = sqliteTable(
  "label",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    name: text().notNull(),
    colorKey: colorKey().notNull(),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("label_workspace_id_idx").on(table.workspaceId),
    uniqueIndex("label_workspace_id_name_unique").on(
      table.workspaceId,
      sql`${table.name} collate nocase`,
    ),
    // Target for the composite foreign key on label_on_issue.
    unique("label_id_workspace_id_unique").on(table.id, table.workspaceId),
  ],
);

export const labelOnIssue = sqliteTable(
  "label_on_issue",
  {
    labelId: text().notNull(),
    issueId: text().notNull(),
    // Both foreign keys include it, so a label can only be attached to an issue in its own workspace.
    workspaceId: text().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.labelId, table.issueId],
    }),
    index("label_on_issue_issue_id_idx").on(table.issueId),
    foreignKey({
      name: "label_on_issue_label_workspace_fk",
      columns: [table.labelId, table.workspaceId],
      foreignColumns: [label.id, label.workspaceId],
    }).onDelete("cascade"),
    foreignKey({
      name: "label_on_issue_issue_workspace_fk",
      columns: [table.issueId, table.workspaceId],
      foreignColumns: [issue.id, issue.workspaceId],
    }).onDelete("cascade"),
  ],
);

export type Label = typeof label.$inferSelect;
export type NewLabel = typeof label.$inferInsert;
export type LabelOnIssue = typeof labelOnIssue.$inferSelect;
export type NewLabelOnIssue = typeof labelOnIssue.$inferInsert;
export type SerializedLabel = JSONParsed<Label>;
