import type { JSONContent } from "@tiptap/core";
import { randomUUIDv7 } from "bun";
import {
  foreignKey,
  index,
  integer,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps, sqliteTable, timestamps } from "../utils";
import { user } from "./auth.schema";
import { issueSprint } from "./issue-sprint.schema";
import { label } from "./label.schema";
import { team } from "./team.schema";
import { timeEntry } from "./time-entry.schema";

export const issueStatusValues = ["to_do", "in_progress", "done"] as const;
export type IssueStatus = (typeof issueStatusValues)[number];

export const issuePriorityValues = ["low", "medium", "high", "urgent"] as const;
export type IssuePriority = (typeof issuePriorityValues)[number];

export const issueChangeEventTypeValues = [
  "issue_created",
  "issue_updated",
  "issue_deleted",
  "summary_changed",
  "description_changed",
  "status_changed",
  "priority_changed",
  "assignee_changed",
  "label_added",
  "label_removed",
  "comment_added",
  "comment_updated",
  "comment_deleted",
  "attachment_added",
  "attachment_removed",
  "time_logged",
] as const;
export type IssueChangeEventType = (typeof issueChangeEventTypeValues)[number];

/**
 * Before/after values of changed fields. The description is left out on purpose: a
 * `description_changed` event records that it changed, not two copies of the document.
 */
export type IssueFieldChanges = {
  [K in Exclude<keyof Issue, "description" | "descriptionText">]?: {
    from: Issue[K] | null;
    to: Issue[K] | null;
  };
};

export const issueSequence = sqliteTable("issue_sequence", {
  teamId: text()
    .primaryKey()
    .references(() => team.id, { onDelete: "cascade" }),
  currentSequence: integer().notNull().default(0),
});

export const issue = sqliteTable(
  "issue",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    // Denormalized `${team.key}-${keyNumber}`. Team renames rewrite it in the same transaction.
    key: text().notNull(),
    workspaceId: text().notNull(),
    teamId: text().notNull(),
    createdById: text()
      .notNull()
      .references(() => user.id),
    assignedToId: text().references(() => user.id, { onDelete: "set null" }),
    sprintId: text(),
    keyNumber: integer().notNull(),
    summary: text().notNull(),
    status: text({ enum: issueStatusValues }).notNull().default("to_do"),
    description: text({ mode: "json" }).notNull().$type<JSONContent>(),
    // Plain text of `description`, kept in sync on write. Search runs against this.
    descriptionText: text().notNull().default(""),
    sortOrder: integer().default(0).notNull(),
    priority: text({ enum: issuePriorityValues }).notNull().default("medium"),
    estimationPoints: integer(),
    ...lifecycleTimestamps,
  },
  (table) => [
    uniqueIndex("issue_key_workspace_id_unique").on(table.key, table.workspaceId),
    uniqueIndex("issue_team_id_key_number_unique").on(table.teamId, table.keyNumber),
    // Target for composite foreign keys that pin child rows to the issue's workspace.
    unique("issue_id_workspace_id_unique").on(table.id, table.workspaceId),
    foreignKey({
      name: "issue_team_workspace_fk",
      columns: [table.teamId, table.workspaceId],
      foreignColumns: [team.id, team.workspaceId],
    }).onDelete("cascade"),
    foreignKey({
      name: "issue_sprint_team_fk",
      columns: [table.sprintId, table.teamId],
      foreignColumns: [issueSprint.id, issueSprint.teamId],
    }),
    index("issue_workspace_id_idx").on(table.workspaceId),
    index("issue_team_id_idx").on(table.teamId),
    index("issue_created_by_id_idx").on(table.createdById),
    index("issue_assigned_to_id_idx").on(table.assignedToId),
    index("issue_sprint_id_idx").on(table.sprintId),
    index("issue_team_workspace_deleted_idx").on(table.teamId, table.workspaceId, table.deletedAt),
    index("issue_team_sprint_deleted_idx").on(table.teamId, table.sprintId, table.deletedAt),
    index("issue_assigned_workspace_deleted_idx").on(
      table.assignedToId,
      table.workspaceId,
      table.deletedAt,
    ),
  ],
);

export const issueChangeEvent = sqliteTable(
  "issue_change_event",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    issueId: text().notNull(),
    workspaceId: text().notNull(),
    actorId: text()
      .notNull()
      .references(() => user.id),
    eventType: text({ enum: issueChangeEventTypeValues }).notNull(),
    changes: text({ mode: "json" }).$type<IssueFieldChanges>(),
    commentId: text().references(() => issueComment.id, { onDelete: "set null" }),
    attachmentId: text().references(() => issueAttachment.id, { onDelete: "set null" }),
    labelId: text().references(() => label.id, { onDelete: "set null" }),
    timeEntryId: text().references(() => timeEntry.id, { onDelete: "set null" }),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$default(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "issue_change_event_issue_workspace_fk",
      columns: [table.issueId, table.workspaceId],
      foreignColumns: [issue.id, issue.workspaceId],
    }).onDelete("cascade"),
    index("issue_change_event_issue_id_idx").on(table.issueId),
    index("issue_change_event_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("issue_change_event_type_idx").on(table.eventType),
    index("issue_change_event_actor_id_idx").on(table.actorId),
    index("issue_change_event_comment_id_idx").on(table.commentId),
    index("issue_change_event_attachment_id_idx").on(table.attachmentId),
    index("issue_change_event_label_id_idx").on(table.labelId),
    index("issue_change_event_time_entry_id_idx").on(table.timeEntryId),
  ],
);

export const issueComment = sqliteTable(
  "issue_comment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    issueId: text()
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    authorId: text()
      .notNull()
      .references(() => user.id),
    content: text({ mode: "json" }).$type<JSONContent>(),
    ...lifecycleTimestamps,
  },
  (table) => [
    index("issue_comment_issue_id_idx").on(table.issueId),
    index("issue_comment_author_id_idx").on(table.authorId),
    index("issue_comment_issue_deleted_idx").on(table.issueId, table.deletedAt),
  ],
);

export const issueAttachment = sqliteTable(
  "issue_attachment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    // Null until the attachment is linked to an issue. Unlinked rows are removed by the
    // `cleanup-orphan-attachment` job.
    issueId: text().references(() => issue.id, { onDelete: "cascade" }),
    createdById: text()
      .notNull()
      .references(() => user.id),
    filePath: text().notNull(),
    mimeType: text().notNull(),
    originalFileName: text().notNull(),
    // Null for files uploaded before sizes were recorded.
    sizeBytes: integer(),
    ...timestamps,
  },
  (table) => [
    index("issue_attachment_issue_id_idx").on(table.issueId),
    index("issue_attachment_created_by_id_idx").on(table.createdById),
  ],
);

export type IssueSequence = typeof issueSequence.$inferSelect;
export type NewIssueSequence = typeof issueSequence.$inferInsert;
export type Issue = typeof issue.$inferSelect;
export type NewIssue = typeof issue.$inferInsert;
export type IssueChangeEvent = typeof issueChangeEvent.$inferSelect;
export type NewIssueChangeEvent = typeof issueChangeEvent.$inferInsert;
export type IssueComment = typeof issueComment.$inferSelect;
export type NewIssueComment = typeof issueComment.$inferInsert;
export type IssueAttachment = typeof issueAttachment.$inferSelect;
export type NewIssueAttachment = typeof issueAttachment.$inferInsert;

export type SerializedIssue = JSONParsed<typeof issue.$inferSelect>;
export type SerializedIssueWithoutDescription = Omit<SerializedIssue, "description">;
export type NewSerializedIssue = JSONParsed<typeof issue.$inferInsert>;
export type SerializedIssueChangeEvent = JSONParsed<typeof issueChangeEvent.$inferSelect>;
export type NewSerializedIssueChangeEvent = JSONParsed<typeof issueChangeEvent.$inferInsert>;
export type SerializedIssueComment = JSONParsed<typeof issueComment.$inferSelect>;
export type NewSerializedIssueComment = JSONParsed<typeof issueComment.$inferInsert>;
export type SerializedIssueAttachment = JSONParsed<typeof issueAttachment.$inferSelect>;
export type NewSerializedIssueAttachment = JSONParsed<typeof issueAttachment.$inferInsert>;

export const issueSelectSchema = createSelectSchema(issue);
export const issueInsertSchema = createInsertSchema(issue);
export const issueUpdateSchema = createUpdateSchema(issue);
