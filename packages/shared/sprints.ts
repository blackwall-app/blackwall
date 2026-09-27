import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { IssueListItem } from "./issues";
import { IssueSprint } from "./models";
import { TeamNotFound } from "./teams";

/** A calendar day as `YYYY-MM-DD`. */
const SprintDate = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(
      (date: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !Number.isNaN(Date.parse(date)) &&
        new Date(date).toISOString().startsWith(date),
      { expected: "a date as YYYY-MM-DD" },
    ),
  ),
);

const SprintName = Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100)));

const endsOnOrAfterStart = Schema.makeFilter(
  ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    endDate >= startDate
      ? undefined
      : { path: ["endDate"], issue: "End date must be on or after start date" },
);

export const SprintDetailsSchema = Schema.Struct({
  name: SprintName,
  goal: Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isMaxLength(500)))),
  startDate: SprintDate,
  endDate: SprintDate,
}).pipe(Schema.check(endsOnOrAfterStart));

export type SprintDetails = typeof SprintDetailsSchema.Type;

export const CompleteSprintSchema = Schema.Union([
  Schema.Struct({
    onUndoneIssues: Schema.Literal("moveToBacklog"),
  }),
  Schema.Struct({
    onUndoneIssues: Schema.Literal("moveToPlannedSprint"),
    targetSprintId: Schema.String,
  }),
  Schema.Struct({
    onUndoneIssues: Schema.Literal("moveToNewSprint"),
    newSprint: Schema.Struct({
      name: SprintName,
      startDate: SprintDate,
      endDate: SprintDate,
    }).pipe(Schema.check(endsOnOrAfterStart)),
  }),
]);

export type CompleteSprint = typeof CompleteSprintSchema.Type;

export const SprintTeamParamsSchema = Schema.Struct({
  teamKey: Schema.String,
});

export const SprintParamsSchema = Schema.Struct({
  teamKey: Schema.String,
  sprintId: Schema.String,
});

export type SprintParams = typeof SprintParamsSchema.Type;

export const SprintIssuesQuerySchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))),
  ),
});

export const SprintListResponse = Schema.Struct({
  sprints: Schema.Array(IssueSprint),
});

export const SprintResponse = Schema.Struct({
  sprint: IssueSprint,
});

export const ActiveSprintResponse = Schema.Struct({
  sprint: Schema.NullOr(IssueSprint),
});

export const SprintWithIssuesResponse = Schema.Struct({
  sprint: IssueSprint,
  issues: Schema.Array(IssueListItem),
  nextCursor: Schema.NullOr(Schema.String),
});

export type SprintWithIssues = typeof SprintWithIssuesResponse.Type;

export const SprintCompleteContextResponse = Schema.Struct({
  sprint: IssueSprint,
  plannedSprints: Schema.Array(IssueSprint),
  hasUndoneIssues: Schema.Boolean,
});

export type SprintCompleteContext = typeof SprintCompleteContextResponse.Type;

export const SprintSuccessResponse = Schema.Struct({
  success: Schema.Boolean,
});

export class IssueSprintNotFound extends ApiError<IssueSprintNotFound>()("IssueSprintNotFound", {
  code: ErrorCode.ISSUE_SPRINT_NOT_FOUND,
  status: 404,
  message: "Issue sprint not found",
}) {}

export class TargetSprintNotFound extends ApiError<TargetSprintNotFound>()("TargetSprintNotFound", {
  code: ErrorCode.TARGET_SPRINT_NOT_FOUND,
  status: 404,
  message: "Target sprint not found",
}) {}

export class CannotStartArchivedSprint extends ApiError<CannotStartArchivedSprint>()(
  "CannotStartArchivedSprint",
  {
    code: ErrorCode.CANNOT_START_ARCHIVED_SPRINT,
    status: 400,
    message: "Cannot start archived sprint",
  },
) {}

export class CannotStartCompletedSprint extends ApiError<CannotStartCompletedSprint>()(
  "CannotStartCompletedSprint",
  {
    code: ErrorCode.CANNOT_START_COMPLETED_SPRINT,
    status: 400,
    message: "Cannot start completed sprint",
  },
) {}

export class SprintAlreadyActive extends ApiError<SprintAlreadyActive>()("SprintAlreadyActive", {
  code: ErrorCode.SPRINT_ALREADY_ACTIVE,
  status: 400,
  message: "Sprint is already active",
}) {}

export class CannotStartWhileSprintActive extends ApiError<CannotStartWhileSprintActive>()(
  "CannotStartWhileSprintActive",
  {
    code: ErrorCode.CANNOT_START_WHILE_SPRINT_ACTIVE,
    status: 400,
    message: "Cannot start sprint while another sprint is active",
  },
) {}

export class CannotUpdateArchivedSprint extends ApiError<CannotUpdateArchivedSprint>()(
  "CannotUpdateArchivedSprint",
  {
    code: ErrorCode.CANNOT_UPDATE_ARCHIVED_SPRINT,
    status: 400,
    message: "Cannot update archived sprint",
  },
) {}

export class CannotUpdateCompletedSprint extends ApiError<CannotUpdateCompletedSprint>()(
  "CannotUpdateCompletedSprint",
  {
    code: ErrorCode.CANNOT_UPDATE_COMPLETED_SPRINT,
    status: 400,
    message: "Cannot update completed sprint",
  },
) {}

export class CannotCompleteArchivedSprint extends ApiError<CannotCompleteArchivedSprint>()(
  "CannotCompleteArchivedSprint",
  {
    code: ErrorCode.CANNOT_COMPLETE_ARCHIVED_SPRINT,
    status: 400,
    message: "Cannot complete archived sprint",
  },
) {}

export class SprintAlreadyCompleted extends ApiError<SprintAlreadyCompleted>()(
  "SprintAlreadyCompleted",
  {
    code: ErrorCode.SPRINT_ALREADY_COMPLETED,
    status: 400,
    message: "Sprint already completed",
  },
) {}

export class OnlyActiveSprintsCanBeCompleted extends ApiError<OnlyActiveSprintsCanBeCompleted>()(
  "OnlyActiveSprintsCanBeCompleted",
  {
    code: ErrorCode.ONLY_ACTIVE_SPRINTS_CAN_BE_COMPLETED,
    status: 400,
    message: "Only active sprints can be completed",
  },
) {}

export class SprintNotCurrentlyActive extends ApiError<SprintNotCurrentlyActive>()(
  "SprintNotCurrentlyActive",
  {
    code: ErrorCode.SPRINT_NOT_CURRENTLY_ACTIVE,
    status: 400,
    message: "Sprint is not currently active",
  },
) {}

export class TargetSprintMustBePlanned extends ApiError<TargetSprintMustBePlanned>()(
  "TargetSprintMustBePlanned",
  {
    code: ErrorCode.TARGET_SPRINT_MUST_BE_PLANNED,
    status: 400,
    message: "Target sprint must be planned",
  },
) {}

export class SprintAlreadyArchived extends ApiError<SprintAlreadyArchived>()(
  "SprintAlreadyArchived",
  {
    code: ErrorCode.SPRINT_ALREADY_ARCHIVED,
    status: 400,
    message: "Sprint is already archived",
  },
) {}

export class CannotArchiveActiveSprint extends ApiError<CannotArchiveActiveSprint>()(
  "CannotArchiveActiveSprint",
  {
    code: ErrorCode.CANNOT_ARCHIVE_ACTIVE_SPRINT,
    status: 400,
    message: "Cannot archive active sprint",
  },
) {}

export class SprintsApi extends HttpApiGroup.make("sprints")
  .add(
    HttpApiEndpoint.get("list", "/:teamKey/sprints", {
      params: SprintTeamParamsSchema,
      success: SprintListResponse,
      error: TeamNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.get("active", "/:teamKey/sprints/active", {
      params: SprintTeamParamsSchema,
      success: ActiveSprintResponse,
      error: TeamNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/:teamKey/sprints/:sprintId", {
      params: SprintParamsSchema,
      query: SprintIssuesQuerySchema,
      success: SprintWithIssuesResponse,
      error: [TeamNotFound, IssueSprintNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.get("completeContext", "/:teamKey/sprints/:sprintId/complete-context", {
      params: SprintParamsSchema,
      success: SprintCompleteContextResponse,
      error: [TeamNotFound, IssueSprintNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/:teamKey/sprints", {
      params: SprintTeamParamsSchema,
      payload: SprintDetailsSchema,
      success: SprintResponse.pipe(HttpApiSchema.status(201)),
      error: TeamNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.post("start", "/:teamKey/sprints/:sprintId/start", {
      params: SprintParamsSchema,
      success: SprintResponse,
      error: [
        TeamNotFound,
        IssueSprintNotFound,
        CannotStartArchivedSprint,
        CannotStartCompletedSprint,
        SprintAlreadyActive,
        CannotStartWhileSprintActive,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/:teamKey/sprints/:sprintId", {
      params: SprintParamsSchema,
      payload: SprintDetailsSchema,
      success: SprintResponse,
      error: [
        TeamNotFound,
        IssueSprintNotFound,
        CannotUpdateArchivedSprint,
        CannotUpdateCompletedSprint,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.post("complete", "/:teamKey/sprints/:sprintId/complete", {
      params: SprintParamsSchema,
      payload: CompleteSprintSchema,
      success: SprintSuccessResponse,
      error: [
        TeamNotFound,
        IssueSprintNotFound,
        CannotCompleteArchivedSprint,
        SprintAlreadyCompleted,
        OnlyActiveSprintsCanBeCompleted,
        SprintNotCurrentlyActive,
        TargetSprintNotFound,
        TargetSprintMustBePlanned,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.delete("archive", "/:teamKey/sprints/:sprintId", {
      params: SprintParamsSchema,
      success: SprintSuccessResponse,
      error: [TeamNotFound, IssueSprintNotFound, SprintAlreadyArchived, CannotArchiveActiveSprint],
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/teams") {}
