import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { betterAuthRoutes } from "./features/auth/better-auth.routes";
import { env } from "./lib/zod-env";
import { workspaceRoutes } from "./features/workspaces/workspace.routes";
import { teamRoutes } from "./features/teams/team.routes";
import { issueRoutes } from "./features/issues/issue.routes";
import { commentRoutes } from "./features/issues/comment.routes";
import { attachmentRoutes, attachmentDownloadRoutes } from "./features/issues/attachment.routes";
import { labelRoutes } from "./features/issues/label.routes";
import { issueSprintRoutes } from "./features/issue-sprints/issue-sprint.routes";
import { timeEntryRoutes } from "./features/time-entries/time-entry.routes";
import { globalSearchRoutes } from "./features/global-search/global-search.routes";
import { settingsRoutes } from "./features/settings/settings.routes";
import {
  invitationRoutes,
  publicInvitationRoutes,
  protectedInvitationRoutes,
} from "./features/invitations/invitation.routes";
import type { AppEnv } from "./lib/hono-env";
import { authRoutes } from "./features/auth/auth.routes";
import { errorHandler } from "./lib/error-handler";

const app = new Hono<AppEnv>()
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

  // Public routes
  .route("/api/better-auth", betterAuthRoutes)
  .route("/api/auth", authRoutes)
  .route("/api/invitations", publicInvitationRoutes)

  // Protected routes
  .route("/api/workspaces", workspaceRoutes)
  .route("/api/invitations", protectedInvitationRoutes)
  .route("/api/issues", attachmentDownloadRoutes)

  // Protected per-workspace routes
  .route("/api/teams", teamRoutes)
  .route("/api/issues", issueRoutes)
  .route("/api/issues", commentRoutes)
  .route("/api/issues", attachmentRoutes)
  .route("/api/labels", labelRoutes)
  .route("/api/issue-sprints", issueSprintRoutes)
  .route("/api/time-entries", timeEntryRoutes)
  .route("/api/search", globalSearchRoutes)
  .route("/api/invitations", invitationRoutes)
  .route("/api/settings", settingsRoutes);

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
app.get("/api/docs", Scalar({ url: "/api/docs/openapi" }));

export type AppType = typeof app;
export { app };

export default {
  port: 8000,
  fetch: app.fetch,
};
