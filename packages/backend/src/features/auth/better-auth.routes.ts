import { Hono } from "hono";
import { runtime } from "../../lib/effect/runtime";
import { Auth } from "./Auth";

const betterAuthRoutes = new Hono().on(["POST", "GET"], "/*", (c) =>
  runtime.runPromise(Auth.use((auth) => auth.handleRequest(c.req.raw))),
);

export { betterAuthRoutes };
