import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { AuthEmail, AuthPassword, UserAlreadyExists } from "./auth-api";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { User } from "./models";

export const CreateInvitationSchema = Schema.Struct({
  email: AuthEmail,
});

export type CreateInvitation = typeof CreateInvitationSchema.Type;

export const InvitationTokenParamsSchema = Schema.Struct({
  token: Schema.String,
});

export type InvitationTokenParams = typeof InvitationTokenParamsSchema.Type;

export const RegisterWithInvitationSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(2))),
  password: AuthPassword,
});

export type RegisterWithInvitation = typeof RegisterWithInvitationSchema.Type;

/** The token is only stored as a hash, so responses carry it only when it's created. */
export const Invitation = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  createdById: Schema.String,
  email: Schema.String,
  expiresAt: Schema.Date,
  acceptedAt: Schema.NullOr(Schema.Date),
  acceptedById: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
});

export type Invitation = typeof Invitation.Type;

export const CreateInvitationResponse = Schema.Struct({
  message: Schema.String,
  invitation: Schema.Struct({ ...Invitation.fields, token: Schema.String }),
  invitationUrl: Schema.String,
});

/** What the invite page shows before the visitor signs up or joins. */
export const InvitationDetails = Schema.Struct({
  email: Schema.String,
  /** Whether the visitor's session user already belongs to the workspace. */
  isMember: Schema.Boolean,
  workspace: Schema.Struct({
    displayName: Schema.String,
    slug: Schema.String,
  }),
});

export type InvitationDetails = typeof InvitationDetails.Type;

export const InvitationDetailsResponse = Schema.Struct({
  invitation: InvitationDetails,
});

export const RegisterWithInvitationResponse = Schema.Struct({
  user: User,
  workspaceSlug: Schema.String,
});

export const AcceptInvitationResponse = Schema.Struct({
  message: Schema.String,
  workspaceSlug: Schema.String,
});

export class InvitationNotFoundOrExpired extends ApiError<InvitationNotFoundOrExpired>()(
  "InvitationNotFoundOrExpired",
  {
    code: ErrorCode.INVITATION_NOT_FOUND_OR_EXPIRED,
    status: 404,
    message: "Invitation not found or expired",
  },
) {}

export class InvitationEmailMismatch extends ApiError<InvitationEmailMismatch>()(
  "InvitationEmailMismatch",
  {
    code: ErrorCode.FORBIDDEN,
    status: 403,
    message: "This invitation was sent to a different email address",
  },
) {}

/**
 * Creating an invitation needs a workspace. Reading one and registering
 * through it are public, since the invitee may not have an account yet.
 * Accepting needs a session whose email matches the invitation.
 */
export class InvitationsApi extends HttpApiGroup.make("invitations")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateInvitationSchema,
      success: CreateInvitationResponse,
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.get("get", "/:token", {
      params: InvitationTokenParamsSchema,
      success: InvitationDetailsResponse,
      error: InvitationNotFoundOrExpired,
    }),
  )
  .add(
    HttpApiEndpoint.post("register", "/:token/register", {
      params: InvitationTokenParamsSchema,
      payload: RegisterWithInvitationSchema,
      success: RegisterWithInvitationResponse,
      error: [InvitationNotFoundOrExpired, UserAlreadyExists],
    }),
  )
  .add(
    HttpApiEndpoint.post("accept", "/:token/accept", {
      params: InvitationTokenParamsSchema,
      success: AcceptInvitationResponse,
      error: [InvitationNotFoundOrExpired, InvitationEmailMismatch],
    }).middleware(Authorization),
  )
  .prefix("/invitations") {}
