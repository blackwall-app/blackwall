import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { Team, User } from "./models";
import { Workspace, WorkspaceSlug, WorkspaceSlugTaken } from "./workspaces";

/** The pattern of zod's `email()`, which better-auth applies on sign-up. */
export const AuthEmail = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/,
      { expected: "an email address" },
    ),
  ),
);

/** better-auth's default password length limits. */
export const AuthPassword = Schema.String.pipe(
  Schema.check(Schema.isMinLength(8), Schema.isMaxLength(128)),
);

export const SignupEmailSchema = Schema.Struct({
  email: AuthEmail,
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(50))),
  password: AuthPassword,
  workspaceDisplayName: Schema.String.pipe(
    Schema.check(Schema.isMinLength(2), Schema.isMaxLength(50)),
  ),
  workspaceUrlSlug: WorkspaceSlug.pipe(
    Schema.check(
      Schema.isMinLength(2),
      Schema.isMaxLength(50),
      Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        expected: "lowercase letters and digits separated by single hyphens",
      }),
    ),
  ),
});

export type SignupEmail = typeof SignupEmailSchema.Type;

export const SignupResponse = Schema.Struct({
  user: User,
  workspace: Workspace,
  team: Team,
});

export class UserAlreadyExists extends ApiError<UserAlreadyExists>()("UserAlreadyExists", {
  code: ErrorCode.USER_ALREADY_EXISTS,
  status: 409,
  message: "An account with this email already exists",
}) {}

/**
 * Sign-up wraps better-auth so the new user gets a workspace in the same
 * request. A successful sign-up sets the session cookie.
 */
export class AuthApi extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("signupEmail", "/signup/email", {
      payload: SignupEmailSchema,
      success: SignupResponse,
      error: [UserAlreadyExists, WorkspaceSlugTaken],
    }),
  )
  .prefix("/auth") {}
