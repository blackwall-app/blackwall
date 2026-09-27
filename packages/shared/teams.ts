import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { IssueSprint, Team, User } from "./models";

export const CreateTeamSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(30))),
  key: Schema.String.pipe(Schema.check(Schema.isMinLength(3), Schema.isMaxLength(5))),
  /** Must be the workspace named by the `x-blackwall-workspace-slug` header. */
  workspaceId: Schema.String.pipe(Schema.check(Schema.isUUID())),
});

export type CreateTeam = typeof CreateTeamSchema.Type;

export const TeamKeyParamsSchema = Schema.Struct({
  teamKey: Schema.String,
});

export type TeamKeyParams = typeof TeamKeyParamsSchema.Type;

/** A team with the sprint it's currently running, if any. */
export const TeamWithActiveSprint = Schema.Struct({
  ...Team.fields,
  activeSprint: Schema.NullOr(IssueSprint),
});

export type TeamWithActiveSprint = typeof TeamWithActiveSprint.Type;

export const TeamResponse = Schema.Struct({
  team: Team,
});

export const TeamWithActiveSprintResponse = Schema.Struct({
  team: TeamWithActiveSprint,
});

export const PreferredTeamResponse = Schema.Struct({
  team: Schema.NullOr(Team),
});

export const TeamListResponse = Schema.Struct({
  teams: Schema.Array(TeamWithActiveSprint),
});

export const TeamUserListResponse = Schema.Struct({
  users: Schema.Array(User),
});

export class TeamNotFoundOrAccessDenied extends ApiError<TeamNotFoundOrAccessDenied>()(
  "TeamNotFoundOrAccessDenied",
  {
    code: ErrorCode.TEAM_NOT_FOUND_OR_ACCESS_DENIED,
    status: 404,
    message: "Team not found or access denied",
  },
) {}

export class TeamNotFoundOrNotMember extends ApiError<TeamNotFoundOrNotMember>()(
  "TeamNotFoundOrNotMember",
  {
    code: ErrorCode.TEAM_NOT_FOUND_OR_NOT_MEMBER,
    status: 404,
    message: "Team not found or you are not a member",
  },
) {}

export class NotMemberOfThisTeam extends ApiError<NotMemberOfThisTeam>()("NotMemberOfThisTeam", {
  code: ErrorCode.NOT_MEMBER_OF_THIS_TEAM,
  status: 403,
  message: "You are not a member of this team",
}) {}

export class TeamKeyAlreadyExists extends ApiError<TeamKeyAlreadyExists>()("TeamKeyAlreadyExists", {
  code: ErrorCode.TEAM_KEY_ALREADY_EXISTS,
  status: 409,
  message: "Team key already exists in this workspace",
}) {}

export class TeamsApi extends HttpApiGroup.make("teams")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateTeamSchema,
      success: TeamResponse,
      error: TeamKeyAlreadyExists,
    }),
  )
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: TeamListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("preferred", "/preferred", {
      success: PreferredTeamResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("listWithActiveSprints", "/with-active-sprints", {
      success: TeamListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("getByKey", "/:teamKey", {
      params: TeamKeyParamsSchema,
      success: TeamWithActiveSprintResponse,
      error: TeamNotFoundOrNotMember,
    }),
  )
  .add(
    HttpApiEndpoint.get("listUsers", "/:teamKey/users", {
      params: TeamKeyParamsSchema,
      success: TeamUserListResponse,
      error: NotMemberOfThisTeam,
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/teams") {}
