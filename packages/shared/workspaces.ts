import { Schema } from "effect";

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

export class Workspace extends Schema.Class<Workspace>("blackwall/Workspace")({
  id: Schema.String,
  displayName: Schema.String,
  slug: WorkspaceSlug,
  logoUrl: Schema.NullOr(Schema.String),
}) {}

export class WorkspaceResponse extends Schema.Class<WorkspaceResponse>(
  "blackwall/WorkspaceResponse",
)({
  workspace: Workspace,
}) {}

export class WorkspaceListResponse extends Schema.Class<WorkspaceListResponse>(
  "blackwall/WorkspaceListResponse",
)({
  workspaces: Schema.Array(Workspace),
}) {}

export const WorkspaceMemberSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: Schema.optional(Schema.NullOr(Schema.String)),
  role: Schema.optional(Schema.String),
  joinedAt: Schema.optional(Schema.Unknown),
});

export type WorkspaceMember = typeof WorkspaceMemberSchema.Type;

export const WorkspaceMemberListSchema = Schema.Struct({
  members: Schema.Array(WorkspaceMemberSchema),
});

export type WorkspaceMemberList = typeof WorkspaceMemberListSchema.Type;

export const WorkspaceMemberResponseSchema = Schema.Struct({
  member: WorkspaceMemberSchema,
});

export type WorkspaceMemberResponse = typeof WorkspaceMemberResponseSchema.Type;
