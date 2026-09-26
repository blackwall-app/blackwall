import type { JSONContent } from "@tiptap/core";
import { Predicate, Schema } from "effect";
import { possibleColors } from "./colors";
import { validateTiptapContent } from "./tiptap/validate";

/**
 * Entity schemas shared by API responses. They mirror the database rows, with
 * timestamps as `Schema.Date`: the server encodes them as ISO strings and the
 * client decodes them back into `Date`s. Encoding drops fields a schema doesn't
 * declare, so leave out columns clients shouldn't see.
 *
 * Group contracts build their responses from these, e.g.
 * `Schema.Struct({ ...Issue.fields, labels: Schema.Array(Label) })`.
 */

/** TipTap JSON in responses. Only checks the shape; the server already validated it on write. */
export const TiptapContent = Schema.Unknown.pipe(
  Schema.refine((u): u is JSONContent => Predicate.isObject(u), { expected: "a TipTap document" }),
);

/** TipTap JSON in request payloads. Parses it against the editor schema. */
export const TiptapDocument = Schema.Unknown.pipe(
  Schema.refine((u): u is JSONContent => validateTiptapContent(u), {
    expected: "a TipTap document",
  }),
);

export const ColorKey = Schema.Literals(possibleColors);
export type ColorKey = typeof ColorKey.Type;

export const IssueStatus = Schema.Literals(["to_do", "in_progress", "done"]);
export type IssueStatus = typeof IssueStatus.Type;

export const IssuePriority = Schema.Literals(["low", "medium", "high", "urgent"]);
export type IssuePriority = typeof IssuePriority.Type;

export const IssueSprintStatus = Schema.Literals(["planned", "active", "completed"]);
export type IssueSprintStatus = typeof IssueSprintStatus.Type;

export const IssueChangeEventType = Schema.Literals([
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
]);
export type IssueChangeEventType = typeof IssueChangeEventType.Type;

const timestamps = {
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
};

const lifecycleTimestamps = {
  ...timestamps,
  deletedAt: Schema.NullOr(Schema.Date),
};

/** Public user fields. Preferences and last-visited ids stay out of responses. */
export const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.NullOr(Schema.Boolean),
  image: Schema.NullOr(Schema.String),
  ...timestamps,
});
export type User = typeof User.Type;

/** What pickers, avatars, and activity logs need from a user. */
export type UserSummary = Pick<User, "id" | "name" | "email" | "image">;

export const Team = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  workspaceId: Schema.String,
  key: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  ...lifecycleTimestamps,
});
export type Team = typeof Team.Type;

export const Label = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  colorKey: ColorKey,
  workspaceId: Schema.String,
  ...timestamps,
});
export type Label = typeof Label.Type;

export const IssueSprint = Schema.Struct({
  id: Schema.String,
  createdById: Schema.String,
  name: Schema.String,
  goal: Schema.NullOr(Schema.String),
  teamId: Schema.String,
  startDate: Schema.Date,
  endDate: Schema.Date,
  status: IssueSprintStatus,
  finishedAt: Schema.NullOr(Schema.Date),
  archivedAt: Schema.NullOr(Schema.Date),
  ...lifecycleTimestamps,
});
export type IssueSprint = typeof IssueSprint.Type;

export const Issue = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  workspaceId: Schema.String,
  teamId: Schema.String,
  createdById: Schema.String,
  assignedToId: Schema.NullOr(Schema.String),
  sprintId: Schema.NullOr(Schema.String),
  keyNumber: Schema.Number,
  summary: Schema.String,
  status: IssueStatus,
  description: TiptapContent,
  sortOrder: Schema.Number,
  priority: IssuePriority,
  estimationPoints: Schema.NullOr(Schema.Number),
  ...lifecycleTimestamps,
});
export type Issue = typeof Issue.Type;

export const IssueComment = Schema.Struct({
  id: Schema.String,
  issueId: Schema.String,
  authorId: Schema.String,
  content: Schema.NullOr(TiptapContent),
  ...lifecycleTimestamps,
});
export type IssueComment = typeof IssueComment.Type;

/** The stored file path is internal; clients download through the attachment id. */
export const IssueAttachment = Schema.Struct({
  id: Schema.String,
  issueId: Schema.NullOr(Schema.String),
  createdById: Schema.String,
  mimeType: Schema.String,
  originalFileName: Schema.String,
  sizeBytes: Schema.NullOr(Schema.Number),
  ...timestamps,
});
export type IssueAttachment = typeof IssueAttachment.Type;

export const IssueChangeEvent = Schema.Struct({
  id: Schema.String,
  issueId: Schema.String,
  workspaceId: Schema.String,
  actorId: Schema.String,
  eventType: IssueChangeEventType,
  changes: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  commentId: Schema.NullOr(Schema.String),
  attachmentId: Schema.NullOr(Schema.String),
  labelId: Schema.NullOr(Schema.String),
  timeEntryId: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
});
export type IssueChangeEvent = typeof IssueChangeEvent.Type;

export const TimeEntry = Schema.Struct({
  id: Schema.String,
  issueId: Schema.String,
  userId: Schema.String,
  durationMinutes: Schema.Number,
  description: Schema.NullOr(Schema.String),
  ...lifecycleTimestamps,
});
export type TimeEntry = typeof TimeEntry.Type;
