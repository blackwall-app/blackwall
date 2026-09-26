import { Api } from "@blackwall/shared";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { AppLayer, memoMap, runtime } from "../lib/effect/runtime";
import { HandlersLive } from "./handlers";

const ApiLive = HttpApiBuilder.layer(Api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(HandlersLive));

const DocsLive = HttpApiScalar.layer(Api, { path: "/docs" });

const { dispose, handler } = HttpRouter.toWebHandler(
  Layer.mergeAll(ApiLive, DocsLive).pipe(
    Layer.provide(HttpServer.layerServices),
    Layer.provide(AppLayer),
  ),
  { memoMap },
);

const EFFECT_PREFIX = "/api/effect";

export const handleEffectRequest = (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname.replace(EFFECT_PREFIX, "") || "/";
  return handler(new Request(new URL(path + url.search, url.origin).href, request));
};

export const disposeEffectApi = async () => {
  await dispose();
  await runtime.dispose();
};
