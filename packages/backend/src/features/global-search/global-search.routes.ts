import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import { globalSearchService } from "./global-search.service";
import { globalSearchQuerySchema, globalSearchResponseSchema } from "./global-search.zod";

const globalSearchRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  .get(
    "/",
    describeRoute({
      tags: ["Search"],
      summary: "Search for issues and users",
      description: "Search for issues and users across the workspace using a search query.",
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Search results",
          content: {
            "application/json": {
              schema: resolver(globalSearchResponseSchema),
            },
          },
        },
        401: {
          description: "Unauthorized - not logged in",
        },
        400: {
          description: "Missing required header: x-blackwall-workspace-slug",
        },
      },
    }),
    validator("query", globalSearchQuerySchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { q } = c.req.valid("query");

      const results = await globalSearchService.search({
        searchTerm: q,
        workspaceId: workspace.id,
        userId: user.id,
      });

      return c.json(results);
    },
  );

export { globalSearchRoutes };
