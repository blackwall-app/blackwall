import { Effect, Layer } from "effect";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { ApiRoutes } from "./api";
import { Auth } from "./features/auth/Auth";
import { AppLayer, memoMap, runtime } from "./lib/effect/runtime";
import { HttpSecurityLive } from "./lib/http-security";

const BetterAuthRoutes = HttpRouter.use(
  Effect.fnUntraced(function* (router) {
    const auth = yield* Auth;
    yield* router.add("*", "/api/better-auth/*", (request) =>
      HttpServerRequest.toWeb(request).pipe(
        Effect.flatMap(auth.handleRequest),
        Effect.map(HttpServerResponse.fromWeb),
        Effect.orDie,
      ),
    );
  }),
);

/** Every backend route, with security headers, CSRF and CORS applied to all of them. */
export const AppRoutes = Layer.mergeAll(ApiRoutes, BetterAuthRoutes, HttpSecurityLive);

/**
 * Serves the backend routes plus `extraRoutes` (the CLI adds static files) as a
 * fetch handler on the shared service graph. `dispose` also shuts down `runtime`.
 */
export const makeAppHandler = <E>(
  extraRoutes: Layer.Layer<never, E, HttpRouter.HttpRouter> = Layer.empty,
) => {
  const { dispose, handler } = HttpRouter.toWebHandler(
    Layer.mergeAll(AppRoutes, extraRoutes).pipe(
      Layer.provide(HttpServer.layerServices),
      Layer.provide(AppLayer),
    ),
    { memoMap },
  );
  return {
    handleRequest: (request: Request) => handler(request),
    dispose: async () => {
      await dispose();
      await runtime.dispose();
    },
  };
};
