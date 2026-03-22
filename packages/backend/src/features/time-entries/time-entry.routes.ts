import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod"; // explicit import if not already there, though validator handles it, it's safer for inline schemas
import { timeEntryService } from "./time-entry.service";
import { issueService } from "../issues/issue.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import {
  createTimeEntrySchema,
  timeEntryListSchema,
  timeEntrySchema,
  timeEntryTotalSchema,
} from "./time-entry.zod";
import { issueParamsSchema } from "../issues/issue.zod";

const timeEntryRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * GET /:issueKey/time-entries - List all time entries for an issue.
   */
  .get(
    "/:issueKey/time-entries",
    describeRoute({
      tags: ["Time Entries"],
      summary: "List time entries for an issue",
      responses: {
        200: {
          description: "List of time entries",
          content: { "application/json": { schema: resolver(timeEntryListSchema) } },
        },
      },
    }),
    validator("param", issueParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      const entries = await timeEntryService.listTimeEntriesForIssue({
        issueId: issue.id,
      });

      return c.json({ entries });
    },
  )
  /**
   * GET /:issueKey/time-entries/total - Get total time logged for an issue.
   */
  .get(
    "/:issueKey/time-entries/total",
    describeRoute({
      tags: ["Time Entries"],
      summary: "Get total time logged for an issue",
      responses: {
        200: {
          description: "Total time logged in minutes",
          content: { "application/json": { schema: resolver(timeEntryTotalSchema) } },
        },
      },
    }),
    validator("param", issueParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      const totalMinutes = await timeEntryService.getTotalTimeLoggedForIssue({
        issueId: issue.id,
      });

      return c.json({ totalMinutes });
    },
  )
  /**
   * POST /:issueKey/time-entries - Create a new time entry for an issue.
   */
  .post(
    "/:issueKey/time-entries",
    describeRoute({
      tags: ["Time Entries"],
      summary: "Create a new time entry",
      responses: {
        201: {
          description: "Created time entry",
          content: {
            "application/json": { schema: resolver(z.object({ entry: timeEntrySchema })) },
          },
        },
      },
    }),
    validator("param", issueParamsSchema),
    validator("json", createTimeEntrySchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");
      const body = c.req.valid("json");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      const entry = await timeEntryService.createTimeEntry({
        issueId: issue.id,
        workspaceId: workspace.id,
        userId: user.id,
        duration: body.duration,
        description: body.description,
      });

      return c.json({ entry }, 201);
    },
  )
  /**
   * DELETE /:issueKey/time-entries/:timeEntryId - Delete a time entry.
   */
  .delete(
    "/:issueKey/time-entries/:timeEntryId",
    describeRoute({
      tags: ["Time Entries"],
      summary: "Delete a time entry",
      responses: {
        200: {
          description: "Time entry deleted",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", issueParamsSchema.extend({ timeEntryId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey, timeEntryId } = c.req.valid("param");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      await timeEntryService.deleteTimeEntry({
        timeEntryId,
        issueId: issue.id,
        userId: user.id,
      });

      return c.json({ success: true });
    },
  );

export { timeEntryRoutes };
