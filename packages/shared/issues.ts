import { Schema, SchemaTransformation, Struct } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { LabelNotFound } from "./labels";
import {
  Issue,
  IssueChangeEvent,
  IssueComment,
  IssuePriority,
  IssueSprint,
  IssueStatus,
  Label,
  Team,
  TiptapDocument,
  User,
} from "./models";
import { TeamNotFoundOrAccessDenied } from "./teams";

export class IssueNotFound extends ApiError<IssueNotFound>()("IssueNotFound", {
  code: ErrorCode.ISSUE_NOT_FOUND,
  status: 404,
  message: "Issue not found",
}) {}

export class IssuesNotAccessible extends ApiError<IssuesNotAccessible>()("IssuesNotAccessible", {
  code: ErrorCode.ISSUES_NOT_ACCESSIBLE,
  status: 403,
  message: "Some issues are not accessible to the current user",
}) {}

export class PreviousAndNextIssuesMustBeDifferent extends ApiError<PreviousAndNextIssuesMustBeDifferent>()(
  "PreviousAndNextIssuesMustBeDifferent",
  {
    code: ErrorCode.PREVIOUS_AND_NEXT_ISSUES_MUST_BE_DIFFERENT,
    status: 400,
    message: "Previous and next issues must be different",
  },
) {}

export class PreviousIssueNotInTargetColumn extends ApiError<PreviousIssueNotInTargetColumn>()(
  "PreviousIssueNotInTargetColumn",
  {
    code: ErrorCode.PREVIOUS_ISSUE_NOT_IN_TARGET_COLUMN,
    status: 400,
    message: "Previous issue is not in the target column",
  },
) {}

export class NextIssueNotInTargetColumn extends ApiError<NextIssueNotInTargetColumn>()(
  "NextIssueNotInTargetColumn",
  {
    code: ErrorCode.NEXT_ISSUE_NOT_IN_TARGET_COLUMN,
    status: 400,
    message: "Next issue is not in the target column",
  },
) {}

export class TargetColumnRequiresAdjacentIssue extends ApiError<TargetColumnRequiresAdjacentIssue>()(
  "TargetColumnRequiresAdjacentIssue",
  {
    code: ErrorCode.TARGET_COLUMN_REQUIRES_ADJACENT_ISSUE,
    status: 400,
    message: "A non-empty target column requires a previous or next issue",
  },
) {}

export class UnableToDetermineIssueSortOrder extends ApiError<UnableToDetermineIssueSortOrder>()(
  "UnableToDetermineIssueSortOrder",
  {
    code: ErrorCode.UNABLE_TO_DETERMINE_ISSUE_SORT_ORDER,
    status: 400,
    message: "Unable to determine issue sort order for this move",
  },
) {}

export class IssueLabelLimitReached extends ApiError<IssueLabelLimitReached>()(
  "IssueLabelLimitReached",
  {
    code: ErrorCode.ISSUE_LABEL_LIMIT_REACHED,
    status: 400,
    message: "The issue has the maximum number of labels",
  },
) {}

/** An issue in a list: no description, with its assignee, labels, and sprint. */
export const IssueListItem = Schema.Struct({
  ...Issue.mapFields(Struct.omit(["description"])).fields,
  assignedTo: Schema.NullOr(User),
  labels: Schema.Array(Label),
  issueSprint: Schema.NullOr(IssueSprint),
});

export type IssueListItem = typeof IssueListItem.Type;

/** A list item that also names its team, for lists that can span teams. */
export const IssueListItemWithTeam = Schema.Struct({
  ...IssueListItem.fields,
  team: Schema.NullOr(Team),
});

export type IssueListItemWithTeam = typeof IssueListItemWithTeam.Type;

const fieldChange = <S extends Schema.Top>(schema: S) =>
  Schema.optional(Schema.Struct({ from: Schema.NullOr(schema), to: Schema.NullOr(schema) }));

/** Before/after values of the fields an update changed. The description is never recorded. */
export const IssueFieldChanges = Schema.Struct({
  summary: fieldChange(Schema.String),
  status: fieldChange(IssueStatus),
  priority: fieldChange(IssuePriority),
  assignedToId: fieldChange(Schema.String),
  sprintId: fieldChange(Schema.String),
  estimationPoints: fieldChange(Schema.Number),
  sortOrder: fieldChange(Schema.Number),
});

export const IssueCommentWithAuthor = Schema.Struct({
  ...IssueComment.fields,
  author: User,
});

export type IssueCommentWithAuthor = typeof IssueCommentWithAuthor.Type;

export const IssueChangeEventWithActor = Schema.Struct({
  ...IssueChangeEvent.fields,
  changes: Schema.NullOr(IssueFieldChanges),
  actor: User,
});

export type IssueChangeEventWithActor = typeof IssueChangeEventWithActor.Type;

/** Everything the issue page shows. */
export const IssueDetails = Schema.Struct({
  ...Issue.fields,
  assignedTo: Schema.NullOr(User),
  labels: Schema.Array(Label),
  issueSprint: Schema.NullOr(IssueSprint),
  team: Schema.NullOr(Team),
  comments: Schema.Array(IssueCommentWithAuthor),
  changeEvents: Schema.Array(IssueChangeEventWithActor),
});

export type IssueDetails = typeof IssueDetails.Type;

/** `true` or `false` in a query string. */
const QueryFlag = Schema.Literals(["true", "false"]).pipe(
  Schema.decodeTo(
    Schema.Boolean,
    SchemaTransformation.transform({
      decode: (flag) => flag === "true",
      encode: (value) => (value ? "true" : "false"),
    }),
  ),
);

/** A repeated query parameter arrives as a single string when it appears once. */
const StatusFilters = Schema.Union([IssueStatus, Schema.Array(IssueStatus)]).pipe(
  Schema.decodeTo(
    Schema.Array(IssueStatus),
    SchemaTransformation.transform({
      decode: (value) => (Schema.is(IssueStatus)(value) ? [value] : value),
      encode: (value) => value,
    }),
  ),
);

const PositiveInt = Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0)));

const Summary = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));

export const IssueListQuerySchema = Schema.Struct({
  teamKey: Schema.String,
  statusFilters: Schema.optional(StatusFilters),
  onlyOnActiveSprint: Schema.optional(QueryFlag),
  withoutSprint: Schema.optional(QueryFlag),
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))),
  ),
  /** `false` returns every matching issue in one page. */
  pagination: Schema.optional(QueryFlag),
});

export type IssueListQuery = typeof IssueListQuerySchema.Type;

export const MyIssuesQuerySchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
});

export const CreateIssueSchema = Schema.Struct({
  teamKey: Schema.String,
  issue: Schema.Struct({
    summary: Summary,
    description: TiptapDocument,
    status: Schema.optional(IssueStatus),
    assignedToId: Schema.optional(Schema.NullOr(Schema.String)),
    sprintId: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

export type CreateIssue = typeof CreateIssueSchema.Type;

export const IssueParamsSchema = Schema.Struct({
  issueKey: Schema.String,
});

export const IssueLabelParamsSchema = Schema.Struct({
  issueKey: Schema.String,
  labelId: Schema.String,
});

const bulkUpdateFields = {
  status: Schema.optional(IssueStatus),
  priority: Schema.optional(IssuePriority),
  assignedToId: Schema.optional(Schema.NullOr(Schema.String)),
  sprintId: Schema.optional(Schema.NullOr(Schema.String)),
  estimationPoints: Schema.optional(Schema.NullOr(PositiveInt)),
};

export const UpdateIssueSchema = Schema.Struct({
  ...bulkUpdateFields,
  summary: Schema.optional(Summary),
  description: Schema.optional(TiptapDocument),
  sortOrder: Schema.optional(Schema.Number),
});

export type UpdateIssue = typeof UpdateIssueSchema.Type;

export const BulkUpdateIssuesSchema = Schema.Struct({
  issueKeys: Schema.Array(Schema.String),
  updates: Schema.Struct(bulkUpdateFields),
});

export type BulkUpdateIssues = typeof BulkUpdateIssuesSchema.Type;

export const BulkDeleteIssuesSchema = Schema.Struct({
  issueKeys: Schema.Array(Schema.String),
});

export type BulkDeleteIssues = typeof BulkDeleteIssuesSchema.Type;

/** Moves an issue into a status column, between two neighbors in that column. */
export const MoveIssueSchema = Schema.Struct({
  issueKey: Schema.String,
  status: IssueStatus,
  previousIssueKey: Schema.optional(Schema.NullOr(Schema.String)),
  nextIssueKey: Schema.optional(Schema.NullOr(Schema.String)),
}).pipe(
  Schema.check(
    Schema.makeFilter(({ issueKey, previousIssueKey }) =>
      issueKey === previousIssueKey
        ? { path: ["previousIssueKey"], issue: "Moved issue cannot also be the previous issue" }
        : undefined,
    ),
    Schema.makeFilter(({ issueKey, nextIssueKey }) =>
      issueKey === nextIssueKey
        ? { path: ["nextIssueKey"], issue: "Moved issue cannot also be the next issue" }
        : undefined,
    ),
  ),
);

export type MoveIssue = typeof MoveIssueSchema.Type;

export const AddIssueLabelSchema = Schema.Struct({
  labelId: Schema.String,
});

export const IssueListResponse = Schema.Struct({
  issues: Schema.Array(IssueListItemWithTeam),
  nextCursor: Schema.NullOr(Schema.String),
});

export const IssueResponse = Schema.Struct({
  issue: Issue,
});

export const IssueDetailsResponse = Schema.Struct({
  issue: IssueDetails,
});

export const IssueBulkResponse = Schema.Struct({
  issues: Schema.Array(Issue),
});

export const IssueMessageResponse = Schema.Struct({
  message: Schema.String,
});

export const IssueSuccessResponse = Schema.Struct({
  success: Schema.Boolean,
});

export class IssuesApi extends HttpApiGroup.make("issues")
  .add(
    HttpApiEndpoint.get("list", "/", {
      query: IssueListQuerySchema,
      success: IssueListResponse,
      error: TeamNotFoundOrAccessDenied,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateIssueSchema,
      success: IssueResponse,
      error: TeamNotFoundOrAccessDenied,
    }),
  )
  .add(
    HttpApiEndpoint.get("my", "/my", {
      query: MyIssuesQuerySchema,
      success: IssueListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/:issueKey", {
      params: IssueParamsSchema,
      success: IssueDetailsResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied],
    }),
  )
  .add(
    HttpApiEndpoint.patch("bulkUpdate", "/bulk", {
      payload: BulkUpdateIssuesSchema,
      success: IssueBulkResponse,
      error: IssuesNotAccessible,
    }),
  )
  .add(
    HttpApiEndpoint.patch("move", "/move", {
      payload: MoveIssueSchema,
      success: IssueSuccessResponse,
      error: [
        IssueNotFound,
        IssuesNotAccessible,
        PreviousAndNextIssuesMustBeDifferent,
        PreviousIssueNotInTargetColumn,
        NextIssueNotInTargetColumn,
        TargetColumnRequiresAdjacentIssue,
        UnableToDetermineIssueSortOrder,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/:issueKey", {
      params: IssueParamsSchema,
      payload: UpdateIssueSchema,
      success: IssueResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied],
    }),
  )
  .add(
    HttpApiEndpoint.delete("bulkDelete", "/bulk", {
      payload: BulkDeleteIssuesSchema,
      success: IssueMessageResponse,
      error: IssuesNotAccessible,
    }),
  )
  .add(
    HttpApiEndpoint.delete("delete", "/:issueKey", {
      params: IssueParamsSchema,
      success: IssueMessageResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied],
    }),
  )
  .add(
    HttpApiEndpoint.post("addLabel", "/:issueKey/labels", {
      params: IssueParamsSchema,
      payload: AddIssueLabelSchema,
      success: IssueSuccessResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied, LabelNotFound, IssueLabelLimitReached],
    }),
  )
  .add(
    HttpApiEndpoint.delete("removeLabel", "/:issueKey/labels/:labelId", {
      params: IssueLabelParamsSchema,
      success: IssueSuccessResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied, LabelNotFound],
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/issues") {}
