import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { handleApiRequest } from "./api";
import { Auth } from "./features/auth/Auth";
import { runtime } from "./lib/effect/runtime";
import { env } from "./lib/env";

const app = new Hono()
  .use("*", secureHeaders())
  .use("*", csrf({ origin: env.APP_BASE_URL }))
  .use(
    "*",
    cors({
      origin: env.APP_BASE_URL,
      allowHeaders: ["Content-Type", "Authorization", "x-blackwall-workspace-slug"],
      allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PATCH"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  )
  .on(["POST", "GET"], "/api/better-auth/*", (c) =>
    runtime.runPromise(Auth.use((auth) => auth.handleRequest(c.req.raw))),
  )
  .all("/api/*", (c) => handleApiRequest(c.req.raw));

export { app };
export { disposeApi } from "./api";

export default {
  port: 8000,
  fetch: app.fetch,
};
