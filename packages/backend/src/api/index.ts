import { Api } from "@blackwall/shared";
import { Database } from "@blackwall/database/effect";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { Auth } from "../features/auth/Auth";
import { WorkspacesHandlers } from "./workspaces";

const ApiLive = HttpApiBuilder.layer(Api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(WorkspacesHandlers));

const DocsLive = HttpApiScalar.layer(Api, { path: "/docs" });

const AllRoutes = Layer.mergeAll(ApiLive, DocsLive);

const { dispose, handler } = HttpRouter.toWebHandler(
  AllRoutes.pipe(
    Layer.provide(HttpServer.layerServices),
    Layer.provide(Database.layer),
    Layer.provide(Auth.layer),
  ),
);

const EFFECT_PREFIX = "/api/effect";

export const handleEffectRequest = (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname.replace(EFFECT_PREFIX, "") || "/";
  return handler(new Request(new URL(path + url.search, url.origin).href, request));
};

export const disposeEffectApi = dispose;
