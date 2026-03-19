import type { JSONContent } from "@tiptap/core";
import { randomUUIDv7 } from "bun";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { JSONParsed } from "hono/utils/types";
import { lifecycleTimestamps } from "../utils";
import { user } from "./auth.schema";
import { issueSprint } from "./issue-sprint.schema";
import { team } from "./team.schema";
import { workspace } from "./workspace.schema";

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

export type IssueFieldChanges = {
  [K in keyof Issue]?: {
    from: Issue[K] | null;
    to: Issue[K] | null;
  };
};

export const issueSequence = sqliteTable(
  "issue_sequence",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id),
    currentSequence: integer("current_sequence").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.teamId],
    }),
  ],
);

export const issue = sqliteTable(
  "issue",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    key: text().notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    assignedToId: text("assigned_to_id").references(() => user.id),
    sprintId: text("sprint_id").references(() => issueSprint.id),
    keyNumber: integer("key_number").notNull(),
    summary: text().notNull(),
    status: text({ enum: issueStatusValues }).notNull().default("to_do"),
    description: text({ mode: "json" }).notNull().$type<JSONContent>(),
    sortOrder: integer("sort_order").default(0).notNull(),
    priority: text({ enum: issuePriorityValues }).notNull().default("medium"),
    estimationPoints: integer("estimation_points"),
    ...lifecycleTimestamps,
  },
  (table) => [
    uniqueIndex("issue_key_workspace_id_unique").on(table.key, table.workspaceId),
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
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    eventType: text("event_type", { enum: issueChangeEventTypeValues })
      .notNull()
      .default("issue_updated"),
    changes: text({ mode: "json" }).$type<IssueFieldChanges>(),
    relatedEntityId: text("related_entity_id"),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$default(() => new Date()),
  },
  (table) => [
    index("issue_change_event_issue_id_idx").on(table.issueId),
    index("issue_change_event_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("issue_change_event_type_idx").on(table.eventType),
    index("issue_change_event_actor_id_idx").on(table.actorId),
  ],
);

export const issueComment = sqliteTable(
  "issue_comment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => randomUUIDv7()),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id),
    authorId: text("author_id")
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
    issueId: text("issue_id").references(() => issue.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    filePath: text().notNull(),
    mimeType: text().notNull(),
    originalFileName: text().notNull(),
    ...lifecycleTimestamps,
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
