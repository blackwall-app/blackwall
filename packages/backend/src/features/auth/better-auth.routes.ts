import { Effect } from "effect";
import { Hono } from "hono";
import { Auth } from "./Auth";

const betterAuthRoutes = new Hono().on(["POST", "GET"], "/*", (c) => {
  return Effect.runPromise(
    Effect.flatMap(Auth, (auth) => auth.handleRequest(c.req.raw)).pipe(Effect.provide(Auth.layer)),
  );
});

export { betterAuthRoutes };
