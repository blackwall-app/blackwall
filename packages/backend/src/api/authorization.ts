import { Authorization, CurrentUser, Unauthorized } from "@blackwall/shared";
import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { Auth } from "../features/auth/Auth";

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const auth = yield* Auth;

    return Authorization.of({
      // better-auth reads the cookie itself, including the `__Secure-` prefixed
      // name it uses on https, so the declared credential is only for OpenAPI.
      session: (httpEffect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const session = yield* auth.getSession(request.headers).pipe(Effect.orDie);
          if (session === null) {
            return yield* new Unauthorized({ message: "Unauthorized" });
          }
          return yield* Effect.provideService(httpEffect, CurrentUser, {
            email: session.user.email,
            id: session.user.id,
            name: session.user.name,
          });
        }),
    });
  }),
);
