import { describeRoute, resolver, validator } from "hono-openapi";
import { Hono } from "hono";
import { teamService } from "./team.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import {
  createTeamSchema,
  teamParamsSchema,
  teamResponseSchema,
  teamListSchema,
  teamWithSprintListSchema,
  teamUserListSchema,
} from "./team.zod";

const teamRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * POST /create - Create a new team in the workspace.
   */
  .post(
    "/create",
    describeRoute({
      tags: ["Teams"],
      summary: "Create team",
      responses: {
        200: {
          description: "Created team",
          content: { "application/json": { schema: resolver(teamResponseSchema) } },
        },
      },
    }),
    validator("json", createTeamSchema),
    async (c) => {
      const validated = c.req.valid("json");
      const team = await teamService.createTeam(validated);

      return c.json({ team: team });
    },
  )
  /**
   * GET / - List teams in the workspace that the current user belongs to.
   */
  .get(
    "/",
    describeRoute({
      tags: ["Teams"],
      summary: "List current user's teams",
      responses: {
        200: {
          description: "List of teams",
          content: { "application/json": { schema: resolver(teamListSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const teams = await teamService.getTeamsForUser({
        workspaceId: workspace.id,
        userId: user.id,
      });

      return c.json({ teams });
    },
  )
  /**
   * GET /preferred - Get the user's preferred team for the workspace.
   */
  .get(
    "/preferred",
    describeRoute({
      tags: ["Teams"],
      summary: "Get preferred team",
      responses: {
        200: {
          description: "Preferred team",
          content: { "application/json": { schema: resolver(teamResponseSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const team = await teamService.getPreferredTeam({
        workspaceId: workspace.id,
        userId: user.id,
      });

      return c.json({ team });
    },
  )
  /**
   * GET /with-active-sprints - List teams the user belongs to that have active sprints.
   */
  .get(
    "/with-active-sprints",
    describeRoute({
      tags: ["Teams"],
      summary: "List teams with active sprints",
      responses: {
        200: {
          description: "Teams with active sprints",
          content: { "application/json": { schema: resolver(teamWithSprintListSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const teams = await teamService.listTeamsWithActiveSprints({
        workspaceId: workspace.id,
        userId: user.id,
      });

      return c.json({ teams });
    },
  )
  /**
   * GET /:teamKey - Get a team by its key.
   */
  .get(
    "/:teamKey",
    describeRoute({
      tags: ["Teams"],
      summary: "Get team by key",
      responses: {
        200: {
          description: "Team details",
          content: { "application/json": { schema: resolver(teamResponseSchema) } },
        },
      },
    }),
    validator("param", teamParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");

      const team = await teamService.getTeamByKey({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      return c.json({ team });
    },
  )
  /**
   * GET /:teamKey/users - List all users in a team.
   */
  .get(
    "/:teamKey/users",
    describeRoute({
      tags: ["Teams"],
      summary: "List team users",
      responses: {
        200: {
          description: "Team users",
          content: { "application/json": { schema: resolver(teamUserListSchema) } },
        },
      },
    }),
    validator("param", teamParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");

      const users = await teamService.listTeamUsers({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      return c.json({ users });
    },
  );

export { teamRoutes };
