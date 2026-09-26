import { Effect, Schema } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { ErrorCode, type ApiErrorCode } from "./error-codes";

/**
 * Base for every error the HTTP API can return. Each error carries a fixed
 * `code` from `ErrorCode`, which the frontend localizes, and a default
 * `message` so call sites can write `new TeamNotFound()`.
 *
 * ```ts
 * export class TeamNotFound extends ApiError<TeamNotFound>()("TeamNotFound", {
 *   code: ErrorCode.TEAM_NOT_FOUND,
 *   status: 404,
 *   message: "Team not found",
 * }) {}
 * ```
 */
export const ApiError =
  <Self>() =>
  <const Tag extends string, const Code extends ApiErrorCode>(
    tag: Tag,
    options: { readonly code: Code; readonly status: number; readonly message: string },
  ) =>
    Schema.TaggedError<Self>()(
      tag,
      {
        code: Schema.tag(options.code),
        message: Schema.String.pipe(Schema.withConstructorDefault(Effect.succeed(options.message))),
      },
      { httpApiStatus: options.status },
    );

export class Unauthorized extends ApiError<Unauthorized>()("Unauthorized", {
  code: ErrorCode.UNAUTHORIZED,
  status: 401,
  message: "Unauthorized",
}) {}

export class ValidationError extends ApiError<ValidationError>()("ValidationError", {
  code: ErrorCode.VALIDATION_ERROR,
  status: 400,
  message: "Invalid request",
}) {}

export class MissingWorkspaceHeader extends ApiError<MissingWorkspaceHeader>()(
  "MissingWorkspaceHeader",
  {
    code: ErrorCode.MISSING_WORKSPACE_HEADER,
    status: 400,
    message: "Missing required header: x-blackwall-workspace-slug",
  },
) {}

export class WorkspaceNotFound extends ApiError<WorkspaceNotFound>()("WorkspaceNotFound", {
  code: ErrorCode.WORKSPACE_NOT_FOUND,
  status: 404,
  message: "Workspace not found",
}) {}

export class NotWorkspaceMember extends ApiError<NotWorkspaceMember>()("NotWorkspaceMember", {
  code: ErrorCode.NOT_WORKSPACE_MEMBER,
  status: 403,
  message: "Current user is not a member of the workspace",
}) {}

/**
 * Applied to the whole `Api`. The server turns request decoding failures into
 * `ValidationError`, so clients get a `code` instead of an empty 400.
 */
export class RequestValidation extends HttpApiMiddleware.Service<RequestValidation>()(
  "blackwall/RequestValidation",
  { error: ValidationError },
) {}
