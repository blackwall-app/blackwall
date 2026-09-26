import { Api, Authorization, WORKSPACE_SLUG_HEADER, WorkspaceMembership } from "@blackwall/shared";
import { Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/unstable/httpapi";
import { HandlersLive } from "../api/handlers";
import { AppLayer } from "../lib/effect/runtime";

/** Real handlers, middleware, and services on the test database. */
const ApiTestLayer = Layer.mergeAll(HandlersLive, HttpServer.layerServices).pipe(
  Layer.provide(AppLayer),
);

export interface ApiClientOptions {
  /** Session cookie from `seedTestSetup`. Leave out to call the API anonymously. */
  readonly cookie?: string;
  /** Sent as `x-blackwall-workspace-slug` to workspace-scoped groups. */
  readonly workspaceSlug?: string;
}

const clientMiddleware = (options: ApiClientOptions) =>
  Layer.mergeAll(
    HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
      next(
        options.cookie === undefined
          ? request
          : HttpClientRequest.setHeader(request, "cookie", options.cookie),
      ),
    ),
    HttpApiMiddleware.layerClient(WorkspaceMembership, ({ next, request }) =>
      next(
        options.workspaceSlug === undefined
          ? request
          : HttpClientRequest.setHeader(request, WORKSPACE_SLUG_HEADER, options.workspaceSlug),
      ),
    ),
  );

/**
 * Runs `f` against the whole `Api` through `HttpApiTest`: requests go through
 * routing, middleware, schema encoding, and the real services, without a server.
 *
 * ```ts
 * const { labels } = await runApi({ cookie, workspaceSlug }, (client) => client.labels.list());
 * const error = await runApi({ cookie }, (client) => Effect.flip(client.labels.list()));
 * ```
 */
export const runApi = <A, E>(
  options: ApiClientOptions,
  f: (client: Effect.Success<ReturnType<typeof makeClient>>) => Effect.Effect<A, E>,
): Promise<A> =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(f),
      Effect.provide(clientMiddleware(options)),
      Effect.provide(ApiTestLayer),
      Effect.scoped,
    ),
  );

const makeClient = () => HttpApiTest.groups(Api, Object.keys(Api.groups) as never);
