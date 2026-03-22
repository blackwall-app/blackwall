import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { issueSprintService } from "./issue-sprint.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import { teamData } from "../teams/team.data";
import { issueData } from "../issues/issue.data";
import {
  createIssueSprintSchema,
  completeIssueSprintSchema,
  updateIssueSprintSchema,
  issueSprintListSchema,
  issueSprintResponseSchema,
  issueSprintCompleteContextSchema,
  issueSprintWithIssuesSchema,
} from "./issue-sprint.zod";
import { ErrorCode } from "@blackwall/shared";
import { NotFoundError } from "../../lib/errors";

const issueSprintRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * GET /:teamKey/sprints - List all sprints for a team.
   */
  .get(
    "/:teamKey/sprints",
    describeRoute({
      tags: ["Sprints"],
      summary: "List all sprints for a team",
      responses: {
        200: {
          description: "List of sprints",
          content: { "application/json": { schema: resolver(issueSprintListSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const sprints = await issueSprintService.listSprints({ teamId: team.id });
      return c.json({ sprints });
    },
  )
  /**
   * GET /:teamKey/sprints/active - Get the active sprint for a team.
   */
  .get(
    "/:teamKey/sprints/active",
    describeRoute({
      tags: ["Sprints"],
      summary: "Get active sprint for a team",
      responses: {
        200: {
          description: "Active sprint",
          content: { "application/json": { schema: resolver(issueSprintResponseSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const sprint = await issueSprintService.getActiveSprint({
        teamId: team.id,
        activeSprintId: team.activeSprintId,
      });

      return c.json({ sprint });
    },
  )
  /**
   * GET /:teamKey/sprints/:sprintId - Get a sprint by its id with associated issues.
   */
  .get(
    "/:teamKey/sprints/:sprintId",
    describeRoute({
      tags: ["Sprints"],
      summary: "Get a sprint by id",
      responses: {
        200: {
          description: "Sprint details with issues",
          content: { "application/json": { schema: resolver(issueSprintWithIssuesSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    validator(
      "query",
      z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().positive().optional().default(50),
      }),
    ),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");
      const { cursor, limit } = c.req.valid("query");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const sprint = await issueSprintService.getSprintById({
        sprintId,
        teamId: team.id,
      });

      const { issues, nextCursor } = await issueData.listIssuesInSprint({
        workspaceId: workspace.id,
        teamId: team.id,
        sprintId,
        cursor,
        limit,
      });

      return c.json({ sprint, issues, nextCursor });
    },
  )
  /**
   * GET /:teamKey/sprints/:sprintId/complete-context - Get data needed for completing a sprint.
   */
  .get(
    "/:teamKey/sprints/:sprintId/complete-context",
    describeRoute({
      tags: ["Sprints"],
      summary: "Get complete sprint context",
      responses: {
        200: {
          description: "Sprint complete context",
          content: { "application/json": { schema: resolver(issueSprintCompleteContextSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const completeContext = await issueSprintService.getSprintCompleteContext({
        sprintId,
        teamId: team.id,
      });

      return c.json(completeContext);
    },
  )
  /**
   * POST /:teamKey/sprints - Create a new sprint.
   */
  .post(
    "/:teamKey/sprints",
    describeRoute({
      tags: ["Sprints"],
      summary: "Create a new sprint",
      responses: {
        201: {
          description: "Created sprint",
          content: { "application/json": { schema: resolver(issueSprintResponseSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string() })),
    validator("json", createIssueSprintSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");
      const body = c.req.valid("json");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const startDate = new Date(body.startDate);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(body.endDate);
      endDate.setUTCHours(23, 59, 59, 999);

      const sprint = await issueSprintService.createSprint({
        name: body.name,
        goal: body.goal,
        startDate,
        endDate,
        createdById: user.id,
        teamId: team.id,
      });

      return c.json({ sprint }, 201);
    },
  )
  /**
   * POST /:teamKey/sprints/:sprintId/start - Start a planned sprint.
   */
  .post(
    "/:teamKey/sprints/:sprintId/start",
    describeRoute({
      tags: ["Sprints"],
      summary: "Start a sprint",
      responses: {
        200: {
          description: "Started sprint",
          content: { "application/json": { schema: resolver(issueSprintResponseSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const sprint = await issueSprintService.startSprint({
        sprintId,
        teamId: team.id,
        activeSprintId: team.activeSprintId,
      });

      return c.json({ sprint });
    },
  )
  /**
   * PATCH /:teamKey/sprints/:sprintId - Update an existing sprint.
   */
  .patch(
    "/:teamKey/sprints/:sprintId",
    describeRoute({
      tags: ["Sprints"],
      summary: "Update a sprint",
      responses: {
        200: {
          description: "Updated sprint",
          content: { "application/json": { schema: resolver(issueSprintResponseSchema) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    validator("json", updateIssueSprintSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");
      const body = c.req.valid("json");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      const startDate = new Date(body.startDate);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(body.endDate);
      endDate.setUTCHours(23, 59, 59, 999);

      const sprint = await issueSprintService.updateSprint({
        sprintId,
        teamId: team.id,
        name: body.name,
        goal: body.goal,
        startDate,
        endDate,
      });

      return c.json({ sprint });
    },
  )
  /**
   * POST /:teamKey/sprints/:sprintId/complete - Mark a sprint as completed.
   */
  .post(
    "/:teamKey/sprints/:sprintId/complete",
    describeRoute({
      tags: ["Sprints"],
      summary: "Complete a sprint",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    validator("json", completeIssueSprintSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");
      const body = c.req.valid("json");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      await issueSprintService.completeSprint({
        sprintId,
        teamId: team.id,
        createdById: user.id,
        activeSprintId: team.activeSprintId,
        completion: body,
      });

      return c.json({ success: true });
    },
  )
  /**
   * DELETE /:teamKey/sprints/:sprintId - Archive a non-active sprint.
   */
  .delete(
    "/:teamKey/sprints/:sprintId",
    describeRoute({
      tags: ["Sprints"],
      summary: "Archive a sprint",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", z.object({ teamKey: z.string(), sprintId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, sprintId } = c.req.valid("param");

      const team = await teamData.getTeamForUser({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
      });

      if (!team) {
        throw new NotFoundError("Team not found", ErrorCode.TEAM_NOT_FOUND);
      }

      await issueSprintService.archiveSprint({
        sprintId,
        teamId: team.id,
        activeSprintId: team.activeSprintId,
      });

      return c.json({ success: true });
    },
  );

export { issueSprintRoutes };
