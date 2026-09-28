import { Api } from "@blackwall/shared";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar, OpenApi } from "effect/unstable/httpapi";
import { AppLayer, memoMap, runtime } from "../lib/effect/runtime";
import { HandlersLive } from "./handlers";

const API_PREFIX = "/api";

const ServedApi = Api.annotate(OpenApi.Servers, [{ url: API_PREFIX }]);

const ApiLive = HttpApiBuilder.layer(ServedApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(HandlersLive));

const DocsLive = HttpApiScalar.layer(ServedApi, { path: "/docs" });

const { dispose, handler } = HttpRouter.toWebHandler(
  Layer.mergeAll(ApiLive, DocsLive).pipe(
    Layer.provide(HttpServer.layerServices),
    Layer.provide(AppLayer),
  ),
  { memoMap },
);

/** The HttpApi defines its paths without the `/api` prefix the app serves it under. */
export const handleApiRequest = (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname.slice(API_PREFIX.length) || "/";
  return handler(new Request(new URL(path + url.search, url.origin).href, request));
};

export const disposeApi = async () => {
  await dispose();
  await runtime.dispose();
};
