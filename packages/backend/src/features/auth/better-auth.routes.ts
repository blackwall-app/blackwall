import { auth } from "./better-auth";
import { Hono } from "hono";

const betterAuthRoutes = new Hono().on(["POST", "GET"], "/*", (c) => {
  return auth.handler(c.req.raw);
});

export { betterAuthRoutes };
