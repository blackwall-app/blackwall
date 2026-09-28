import { Api } from "@blackwall/shared";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar, OpenApi } from "effect/unstable/httpapi";
import { HandlersLive } from "./handlers";

const API_PREFIX = "/api";

const ServedApi = Api.annotate(OpenApi.Servers, [{ url: API_PREFIX }]);

/**
 * The HttpApi defines its paths without `/api`, so the OpenAPI spec lists them
 * relative to the server URL. Mounting it on a prefixed router serves them under `/api`.
 */
const PrefixedRouter = Layer.effect(
  HttpRouter.HttpRouter,
  Effect.map(HttpRouter.HttpRouter, (router) => router.prefixed(API_PREFIX)),
);

/** The HttpApi, its OpenAPI spec and the Scalar docs, all under `/api`. */
export const ApiRoutes = Layer.mergeAll(
  HttpApiBuilder.layer(ServedApi, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(HandlersLive),
  ),
  HttpApiScalar.layer(ServedApi, { path: "/docs" }),
).pipe(Layer.provide(PrefixedRouter));
