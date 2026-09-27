import { Schema, SchemaTransformation } from "effect";
import { Multipart } from "effect/unstable/http";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError, NotWorkspaceMember, WorkspaceNotFound } from "./errors";
import { Team, User } from "./models";
import {
  NotTeamMember,
  TeamKeyAlreadyExists,
  TeamKeyParamsSchema,
  TeamNotFound,
  TeamResponse,
  TeamUserListResponse,
} from "./teams";
import { MemberNotFound, UpdateWorkspaceSchema, WorkspaceResponse } from "./workspaces";

export const PreferredTheme = Schema.Literals(["system", "light", "dark"]);
export type PreferredTheme = typeof PreferredTheme.Type;

export const PreferredLocale = Schema.Literals(["en", "pl"]);
export type PreferredLocale = typeof PreferredLocale.Type;

/** The signed-in user, with the preferences `User` leaves out. */
export const Profile = Schema.Struct({
  ...User.fields,
  preferredTheme: Schema.NullOr(PreferredTheme),
  preferredLocale: Schema.NullOr(PreferredLocale),
});

export type Profile = typeof Profile.Type;

export const ProfileResponse = Schema.Struct({
  profile: Profile,
});

export const UpdateProfileSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.decode(SchemaTransformation.trim()),
    Schema.check(Schema.isMinLength(2), Schema.isMaxLength(100)),
  ),
});

export type UpdateProfile = typeof UpdateProfileSchema.Type;

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A multipart form. `intent: "remove"` clears the avatar, anything else sets it
 * to the image in `file`. The client sends a `FormData`.
 */
export const UpdateAvatarSchema = Schema.Struct({
  intent: Schema.optional(Schema.String),
  file: Schema.optional(Multipart.SingleFileSchema),
}).pipe(HttpApiSchema.asMultipartStream({ maxFileSize: AVATAR_MAX_BYTES }));

export const UpdatePreferredThemeSchema = Schema.Struct({
  theme: PreferredTheme,
});

export const PreferredThemeResponse = UpdatePreferredThemeSchema;

/** `null` drops the override and follows the browser's language. */
export const UpdatePreferredLocaleSchema = Schema.Struct({
  locale: Schema.NullOr(PreferredLocale),
});

export const PreferredLocaleResponse = UpdatePreferredLocaleSchema;

const Password = Schema.String.pipe(Schema.check(Schema.isMinLength(8)));

export const ChangePasswordSchema = Schema.Struct({
  currentPassword: Password,
  newPassword: Password,
  revokeOtherSessions: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.check(
    Schema.makeFilter(({ currentPassword, newPassword }) =>
      currentPassword === newPassword
        ? { path: ["newPassword"], issue: "New password must differ from the current one" }
        : undefined,
    ),
  ),
);

export type ChangePassword = typeof ChangePasswordSchema.Type;

/** Leaving out `displayName` returns the workspace unchanged. */
export const SettingsUpdateWorkspaceSchema = Schema.Struct({
  displayName: Schema.optional(UpdateWorkspaceSchema.fields.displayName),
});

const SettingsTeamName = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
);

const SettingsTeamKey = Schema.String.pipe(
  Schema.decode(SchemaTransformation.toUpperCase()),
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(5)),
);

export const SettingsCreateTeamSchema = Schema.Struct({
  name: SettingsTeamName,
  key: SettingsTeamKey,
});

export type SettingsCreateTeam = typeof SettingsCreateTeamSchema.Type;

export const SettingsUpdateTeamSchema = Schema.Struct({
  name: Schema.optional(SettingsTeamName),
  key: Schema.optional(SettingsTeamKey),
});

export type SettingsUpdateTeam = typeof SettingsUpdateTeamSchema.Type;

export const SettingsAddTeamMemberSchema = Schema.Struct({
  userId: Schema.String.pipe(Schema.check(Schema.isUUID())),
});

export const SettingsTeamMemberParamsSchema = Schema.Struct({
  teamKey: Schema.String,
  userId: Schema.String,
});

export const SettingsTeamWithCounts = Schema.Struct({
  team: Team,
  usersCount: Schema.Number,
  issuesCount: Schema.Number,
});

export type SettingsTeamWithCounts = typeof SettingsTeamWithCounts.Type;

export const SettingsTeamListResponse = Schema.Struct({
  teams: Schema.Array(SettingsTeamWithCounts),
});

export const SettingsTeamWithMembersResponse = Schema.Struct({
  team: Team,
  teamMembers: Schema.Array(User),
});

export const SettingsSuccessResponse = Schema.Struct({
  success: Schema.Boolean,
});

export class ProfileNotFound extends ApiError<ProfileNotFound>()("ProfileNotFound", {
  code: ErrorCode.USER_NOT_FOUND,
  status: 404,
  message: "User not found",
}) {}

export class AvatarFileMissing extends ApiError<AvatarFileMissing>()("AvatarFileMissing", {
  code: ErrorCode.NO_AVATAR_FILE_PROVIDED,
  status: 400,
  message: "No avatar file provided",
}) {}

export class AvatarNotAnImage extends ApiError<AvatarNotAnImage>()("AvatarNotAnImage", {
  code: ErrorCode.ONLY_IMAGE_FILES_SUPPORTED,
  status: 400,
  message: "Only image files are supported",
}) {}

export class AvatarTooLarge extends ApiError<AvatarTooLarge>()("AvatarTooLarge", {
  code: ErrorCode.IMAGE_TOO_LARGE,
  status: 400,
  message: "Image must be smaller than 5MB",
}) {}

export class PasswordChangeFailed extends ApiError<PasswordChangeFailed>()("PasswordChangeFailed", {
  code: ErrorCode.FAILED_TO_CHANGE_PASSWORD,
  status: 400,
  message: "Failed to change password",
}) {}

export class SettingsApi extends HttpApiGroup.make("settings")
  .add(
    HttpApiEndpoint.get("getProfile", "/profile", {
      success: ProfileResponse,
      error: ProfileNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateProfile", "/profile", {
      payload: UpdateProfileSchema,
      success: ProfileResponse,
      error: ProfileNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateAvatar", "/profile/avatar", {
      payload: UpdateAvatarSchema,
      success: ProfileResponse,
      error: [ProfileNotFound, AvatarFileMissing, AvatarNotAnImage, AvatarTooLarge],
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateTheme", "/profile/theme", {
      payload: UpdatePreferredThemeSchema,
      success: PreferredThemeResponse,
      error: ProfileNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateLocale", "/profile/locale", {
      payload: UpdatePreferredLocaleSchema,
      success: PreferredLocaleResponse,
      error: ProfileNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.post("changePassword", "/profile/password", {
      payload: ChangePasswordSchema,
      success: SettingsSuccessResponse,
      error: PasswordChangeFailed,
    }),
  )
  .add(
    HttpApiEndpoint.get("getWorkspace", "/workspace", {
      success: WorkspaceResponse,
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateWorkspace", "/workspace", {
      payload: SettingsUpdateWorkspaceSchema,
      success: WorkspaceResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .add(
    HttpApiEndpoint.get("listTeams", "/teams", {
      success: SettingsTeamListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.post("createTeam", "/teams", {
      payload: SettingsCreateTeamSchema,
      success: TeamResponse,
      error: TeamKeyAlreadyExists,
    }),
  )
  .add(
    HttpApiEndpoint.get("getTeam", "/teams/:teamKey", {
      params: TeamKeyParamsSchema,
      success: SettingsTeamWithMembersResponse,
      error: TeamNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.patch("updateTeam", "/teams/:teamKey", {
      params: TeamKeyParamsSchema,
      payload: SettingsUpdateTeamSchema,
      success: TeamResponse,
      error: [TeamNotFound, TeamKeyAlreadyExists],
    }),
  )
  .add(
    HttpApiEndpoint.get("listAvailableUsers", "/teams/:teamKey/available-users", {
      params: TeamKeyParamsSchema,
      success: TeamUserListResponse,
      error: TeamNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.post("addTeamMember", "/teams/:teamKey/members", {
      params: TeamKeyParamsSchema,
      payload: SettingsAddTeamMemberSchema,
      success: SettingsSuccessResponse,
      error: [TeamNotFound, NotTeamMember, MemberNotFound],
    }),
  )
  .add(
    HttpApiEndpoint.delete("removeTeamMember", "/teams/:teamKey/members/:userId", {
      params: SettingsTeamMemberParamsSchema,
      success: SettingsSuccessResponse,
      error: [TeamNotFound, NotTeamMember],
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/settings") {}
