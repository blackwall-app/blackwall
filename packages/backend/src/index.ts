import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { handleEffectRequest } from "./api";
import { betterAuthRoutes } from "./features/auth/better-auth.routes";
import { env } from "./lib/zod-env";
import type { AppEnv } from "./lib/hono-env";
import { errorHandler } from "./lib/error-handler";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono<AppEnv>()
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
  .onError(errorHandler)

  // Effect HttpApi (v4). New endpoints live here; Hono routes below are
  // mid-migration and move over group by group.
  .all("/api/effect/*", (c) => handleEffectRequest(c.req.raw))

  // Stored issue descriptions link images to this path. Drop it once the
  // HttpApi is served at /api.
  .get("/api/issues/attachments/:attachmentId/download", (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(/^\/api/, "/api/effect");
    return handleEffectRequest(new Request(url.href, c.req.raw));
  })

  // Public routes
  .route("/api/better-auth", betterAuthRoutes);

app.get(
  "/api/docs/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Blackwall API",
        version: "1.0.0",
        description: "API documentation for the Blackwall backend",
      },
      servers: [{ url: "http://localhost:8000", description: "Local development" }],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Session cookie authentication",
          },
        },
      },
    },
  }),
);
app.get(
  "/api/docs",
  Scalar({
    sources: [
      { url: "/api/docs/openapi", title: "API" },
      { url: "/api/better-auth/open-api/generate-schema", title: "Auth" },
    ],
  }),
);

export type AppType = typeof app;
export { app };
export { disposeEffectApi } from "./api";

export default {
  port: 8000,
  fetch: app.fetch,
};
