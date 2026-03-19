import { randomUUIDv7 } from "bun";
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps } from "../utils";
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
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    ...lifecycleTimestamps,
  },
  (table) => [index("label_workspace_id_idx").on(table.workspaceId)],
);

export const labelOnIssue = sqliteTable(
  "label_on_issue",
  {
    labelId: text()
      .notNull()
      .references(() => label.id),
    issueId: text()
      .notNull()
      .references(() => issue.id),
  },
  (table) => [
    primaryKey({
      columns: [table.labelId, table.issueId],
    }),
    index("label_on_issue_issue_id_idx").on(table.issueId),
  ],
);

export type Label = typeof label.$inferSelect;
export type NewLabel = typeof label.$inferInsert;
export type LabelOnIssue = typeof labelOnIssue.$inferSelect;
export type NewLabelOnIssue = typeof labelOnIssue.$inferInsert;
export type SerializedLabel = JSONParsed<Label>;
