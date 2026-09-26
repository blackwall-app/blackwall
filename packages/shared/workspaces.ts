import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError, NotWorkspaceMember, WorkspaceNotFound } from "./errors";
import { Team, User } from "./models";

const DisplayName = Schema.String.pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(30)));

const notApiSlug = Schema.makeFilter((slug: string) =>
  slug === "api" ? "Slug cannot be 'api'" : undefined,
);

const Slug = Schema.String.pipe(
  Schema.check(Schema.isMinLength(2), Schema.isMaxLength(10), notApiSlug),
);

export const WorkspaceSlug = Schema.String.pipe(Schema.check(notApiSlug));

export const CreateWorkspaceSchema = Schema.Struct({
  displayName: DisplayName,
  slug: Slug,
});

export type CreateWorkspace = typeof CreateWorkspaceSchema.Type;

export const UpdateWorkspaceSchema = Schema.Struct({
  displayName: DisplayName,
});

export type UpdateWorkspace = typeof UpdateWorkspaceSchema.Type;

export const WorkspaceIdParamsSchema = Schema.Struct({
  workspaceId: Schema.String,
});

export type WorkspaceIdParams = typeof WorkspaceIdParamsSchema.Type;

export const WorkspaceSlugParamsSchema = Schema.Struct({
  slug: Schema.String,
});

export type WorkspaceSlugParams = typeof WorkspaceSlugParamsSchema.Type;

export const WorkspaceMemberParamsSchema = Schema.Struct({
  slug: Schema.String,
  userId: Schema.String,
});

export type WorkspaceMemberParams = typeof WorkspaceMemberParamsSchema.Type;

export const Workspace = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  slug: WorkspaceSlug,
  logoUrl: Schema.NullOr(Schema.String),
});

export type Workspace = typeof Workspace.Type;

export const WorkspaceResponse = Schema.Struct({
  workspace: Workspace,
});

export const PreferredWorkspaceResponse = Schema.Struct({
  workspace: Schema.NullOr(Workspace),
});

export const WorkspaceListResponse = Schema.Struct({
  workspaces: Schema.Array(Workspace),
});

/** A workspace member with the teams they belong to in that workspace. */
export const WorkspaceMember = Schema.Struct({
  ...User.fields,
  teams: Schema.Array(Team),
});

export type WorkspaceMember = typeof WorkspaceMember.Type;

export const WorkspaceMemberListResponse = Schema.Struct({
  members: Schema.Array(WorkspaceMember),
});

export const WorkspaceMemberResponse = Schema.Struct({
  member: WorkspaceMember,
});

export class WorkspaceSlugTaken extends ApiError<WorkspaceSlugTaken>()("WorkspaceSlugTaken", {
  code: ErrorCode.WORKSPACE_SLUG_TAKEN,
  status: 409,
  message: "Workspace slug is already taken",
}) {}

export class MemberNotFound extends ApiError<MemberNotFound>()("MemberNotFound", {
  code: ErrorCode.MEMBER_NOT_FOUND,
  status: 404,
  message: "Member not found",
}) {}

export class WorkspacesApi extends HttpApiGroup.make("workspaces")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: WorkspaceListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateWorkspaceSchema,
      success: WorkspaceResponse,
      error: WorkspaceSlugTaken,
    }),
  )
  .add(
    HttpApiEndpoint.get("preferred", "/preferred", {
      success: PreferredWorkspaceResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("getBySlug", "/:slug", {
      params: WorkspaceSlugParamsSchema,
      success: WorkspaceResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/:workspaceId", {
      params: WorkspaceIdParamsSchema,
      payload: UpdateWorkspaceSchema,
      success: WorkspaceResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .add(
    HttpApiEndpoint.get("listMembers", "/:slug/members", {
      params: WorkspaceSlugParamsSchema,
      success: WorkspaceMemberListResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .add(
    HttpApiEndpoint.get("getMember", "/:slug/members/:userId", {
      params: WorkspaceMemberParamsSchema,
      success: WorkspaceMemberResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember, MemberNotFound],
    }),
  )
  .middleware(Authorization)
  .prefix("/workspaces") {}
