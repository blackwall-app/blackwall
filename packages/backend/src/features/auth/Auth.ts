import { Context, Effect, Layer, Schema } from "effect";
import { auth } from "./better-auth";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const getSession = Effect.fn("Auth.getSession")(function* (
  headers: globalThis.Headers | Record<string, string>,
) {
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: (cause) => new AuthError({ message: "Failed to read session", cause }),
  });
  return session as AuthSession | null;
});

const handleRequest = Effect.fn("Auth.handleRequest")(function* (request: Request) {
  return yield* Effect.tryPromise({
    try: () => auth.handler(request),
    catch: (cause) => new AuthError({ message: "Auth handler failed", cause }),
  });
});

export class Auth extends Context.Service<
  Auth,
  {
    readonly getSession: (
      headers: globalThis.Headers | Record<string, string>,
    ) => Effect.Effect<AuthSession | null, AuthError>;
    readonly handleRequest: (request: Request) => Effect.Effect<Response, AuthError>;
  }
>()("blackwall/Auth") {
  static readonly layer = Layer.succeed(Auth, Auth.of({ getSession, handleRequest }));
}

export type AuthService = Auth["Service"];
