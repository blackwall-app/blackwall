import { Schema, Struct } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { IssueNotFound } from "./issues";
import { TimeEntry, User } from "./models";
import { TeamNotFoundOrAccessDenied } from "./teams";

export const TimeEntryIssueParamsSchema = Schema.Struct({
  issueKey: Schema.String,
});

export const TimeEntryParamsSchema = Schema.Struct({
  issueKey: Schema.String,
  timeEntryId: Schema.String,
});

export const CreateTimeEntrySchema = Schema.Struct({
  durationMinutes: Schema.Int.check(Schema.isGreaterThan(0)),
  description: Schema.optional(Schema.String),
});

export type CreateTimeEntry = typeof CreateTimeEntrySchema.Type;

export const TimeEntryWithUser = Schema.Struct({
  ...TimeEntry.fields,
  user: User.mapFields(Struct.pick(["id", "name", "image"])),
});

export type TimeEntryWithUser = typeof TimeEntryWithUser.Type;

export const TimeEntryListResponse = Schema.Struct({
  entries: Schema.Array(TimeEntryWithUser),
});

export const TimeEntryTotalResponse = Schema.Struct({
  totalMinutes: Schema.Number,
});

export const TimeEntryResponse = Schema.Struct({
  entry: TimeEntry,
});

export const TimeEntryDeleteResponse = Schema.Struct({
  success: Schema.Boolean,
});

export class TimeEntryNotFound extends ApiError<TimeEntryNotFound>()("TimeEntryNotFound", {
  code: ErrorCode.TIME_ENTRY_NOT_FOUND,
  status: 404,
  message: "Time entry not found",
}) {}

export class TimeEntryDurationMustBePositive extends ApiError<TimeEntryDurationMustBePositive>()(
  "TimeEntryDurationMustBePositive",
  {
    code: ErrorCode.DURATION_MUST_BE_POSITIVE,
    status: 400,
    message: "Duration must be positive",
  },
) {}

export class TimeEntriesApi extends HttpApiGroup.make("timeEntries")
  .add(
    HttpApiEndpoint.get("list", "/:issueKey/time-entries", {
      params: TimeEntryIssueParamsSchema,
      success: TimeEntryListResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied],
    }),
  )
  .add(
    HttpApiEndpoint.get("total", "/:issueKey/time-entries/total", {
      params: TimeEntryIssueParamsSchema,
      success: TimeEntryTotalResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied],
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/:issueKey/time-entries", {
      params: TimeEntryIssueParamsSchema,
      payload: CreateTimeEntrySchema,
      success: TimeEntryResponse.pipe(HttpApiSchema.status(201)),
      error: [IssueNotFound, TeamNotFoundOrAccessDenied, TimeEntryDurationMustBePositive],
    }),
  )
  .add(
    HttpApiEndpoint.delete("delete", "/:issueKey/time-entries/:timeEntryId", {
      params: TimeEntryParamsSchema,
      success: TimeEntryDeleteResponse,
      error: [IssueNotFound, TeamNotFoundOrAccessDenied, TimeEntryNotFound],
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/issues") {}
