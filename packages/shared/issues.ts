import { Schema, Struct } from "effect";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { Issue, IssueSprint, Label, User } from "./models";

export class IssueNotFound extends ApiError<IssueNotFound>()("IssueNotFound", {
  code: ErrorCode.ISSUE_NOT_FOUND,
  status: 404,
  message: "Issue not found",
}) {}

/** An issue in a list: no description, with its assignee, labels, and sprint. */
export const IssueListItem = Schema.Struct({
  ...Issue.mapFields(Struct.omit(["description"])).fields,
  assignedTo: Schema.NullOr(User),
  labels: Schema.Array(Label),
  issueSprint: Schema.NullOr(IssueSprint),
});

export type IssueListItem = typeof IssueListItem.Type;
