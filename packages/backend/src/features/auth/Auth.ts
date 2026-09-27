import { UserAlreadyExists, type User } from "@blackwall/shared";
import { isAPIError } from "better-auth/api";
import { Context, Effect, Layer, Schema } from "effect";
import { Cookies, HttpEffect, HttpServerResponse } from "effect/unstable/http";
import { auth } from "./better-auth";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

export type RequestHeaders = globalThis.Headers | Record<string, string>;

const userExistsCodes = new Set(["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"]);

const getSession = Effect.fn("Auth.getSession")(function* (headers: RequestHeaders) {
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: (cause) => new AuthError({ message: "Failed to read session", cause }),
  });
  return session as AuthSession | null;
});

const signUpEmail = Effect.fn("Auth.signUpEmail")(function* (input: {
  email: string;
  name: string;
  password: string;
  headers: RequestHeaders;
}) {
  const { headers, response } = yield* Effect.tryPromise({
    try: () =>
      auth.api.signUpEmail({
        body: { email: input.email, name: input.name, password: input.password },
        headers: input.headers,
        returnHeaders: true,
      }),
    catch: (cause) =>
      isAPIError(cause) && userExistsCodes.has(cause.body?.code ?? "")
        ? new UserAlreadyExists()
        : new AuthError({ message: "Failed to sign up", cause }),
  });
  const { user } = response;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies User,
    headers,
  };
});

const handleRequest = Effect.fn("Auth.handleRequest")(function* (request: Request) {
  return yield* Effect.tryPromise({
    try: () => auth.handler(request),
    catch: (cause) => new AuthError({ message: "Auth handler failed", cause }),
  });
});

const changePassword = Effect.fn("Auth.changePassword")(function* (input: {
  headers: globalThis.Headers | Record<string, string>;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}) {
  yield* Effect.tryPromise({
    try: () =>
      auth.api.changePassword({
        headers: input.headers,
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: input.revokeOtherSessions,
        },
      }),
    catch: (cause) => new AuthError({ message: "Failed to change password", cause }),
  });
});

export class Auth extends Context.Service<
  Auth,
  {
    readonly getSession: (headers: RequestHeaders) => Effect.Effect<AuthSession | null, AuthError>;
    /**
     * Creates the user and signs them in. `headers` holds better-auth's
     * `Set-Cookie`; pass it to `forwardAuthCookies` once the request succeeds.
     */
    readonly signUpEmail: (input: {
      email: string;
      name: string;
      password: string;
      headers: RequestHeaders;
    }) => Effect.Effect<{ user: User; headers: globalThis.Headers }, UserAlreadyExists | AuthError>;
    readonly handleRequest: (request: Request) => Effect.Effect<Response, AuthError>;
    /** Changes the password of the session's user. Fails on a wrong current password. */
    readonly changePassword: (input: {
      headers: globalThis.Headers | Record<string, string>;
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions: boolean;
    }) => Effect.Effect<void, AuthError>;
  }
>()("blackwall/Auth") {
  static readonly layer = Layer.succeed(
    Auth,
    Auth.of({ getSession, signUpEmail, handleRequest, changePassword }),
  );
}

export type AuthService = Auth["Service"];

/** Copies better-auth's `Set-Cookie` headers onto the HttpApi response. */
export const forwardAuthCookies = (headers: globalThis.Headers) =>
  HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.succeed(
      HttpServerResponse.mergeCookies(response, Cookies.fromSetCookie(headers.getSetCookie())),
    ),
  );
