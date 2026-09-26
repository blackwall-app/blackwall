import { Api } from "@blackwall/shared";
import { Context, Effect, flow, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { backendUrl } from "./env";

export class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "blackwall/ApiClient",
) {
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, {
      transformClient: (client) =>
        client.pipe(
          HttpClient.mapRequest(
            flow(HttpClientRequest.prependUrl(`${backendUrl}/api/effect`), (request) =>
              HttpClientRequest.setHeader(
                request,
                "x-blackwall-workspace-slug",
                window.__workspaceSlug ?? "",
              ),
            ),
          ),
        ),
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

export const runApi = <A, E>(effect: Effect.Effect<A, E, ApiClient>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(ApiClient.layer),
      Effect.provideService(FetchHttpClient.RequestInit, { credentials: "include" }),
    ),
  );
