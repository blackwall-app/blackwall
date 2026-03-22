import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod"; // explicit import if not already there, though validator handles it, it's safer for inline schemas
import { issueService } from "./issue.service";
import { labelService } from "./label.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import {
  listIssuesQuerySchema,
  createIssueSchema,
  issueParamsSchema,
  updateIssueSchema,
  bulkUpdateIssuesSchema,
  bulkDeleteIssuesSchema,
  moveIssueSchema,
  issueListSchema,
  issueResponseSchema,
} from "./issue.zod";

const issueRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * GET / - List issues for a team with optional filters.
   */
  .get(
    "/",
    describeRoute({
      tags: ["Issues"],
      summary: "List issues for a team",
      responses: {
        200: {
          description: "List of issues",
          content: { "application/json": { schema: resolver(issueListSchema) } },
        },
      },
    }),
    validator("query", listIssuesQuerySchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const {
        teamKey,
        statusFilters,
        onlyOnActiveSprint,
        withoutSprint,
        cursor,
        limit,
        pagination,
      } = c.req.valid("query");

      const result = await issueService.listIssuesForTeam({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
        statusFilters,
        onlyOnActiveSprint,
        withoutSprint,
        cursor,
        limit,
        pagination,
      });

      return c.json({ issues: result.issues, nextCursor: result.nextCursor });
    },
  )
  /**
   * POST / - Create a new issue.
   */
  .post(
    "/",
    describeRoute({
      tags: ["Issues"],
      summary: "Create a new issue",
      responses: {
        200: {
          description: "Created issue",
          content: { "application/json": { schema: resolver(issueResponseSchema) } },
        },
      },
    }),
    validator("json", createIssueSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey, issue } = c.req.valid("json");

      const created = await issueService.createIssue({
        workspaceId: workspace.id,
        teamKey,
        userId: user.id,
        issue,
      });

      return c.json({ issue: created });
    },
  )
  /**
   * GET /my - List all issues assigned to the current user.
   */
  .get(
    "/my",
    describeRoute({
      tags: ["Issues"],
      summary: "List assigned issues",
      responses: {
        200: {
          description: "List of assigned issues",
          content: { "application/json": { schema: resolver(issueListSchema) } },
        },
      },
    }),
    validator("query", z.object({ cursor: z.string().optional() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { cursor } = c.req.valid("query");

      const result = await issueService.listIssuesAssignedToUser({
        workspaceId: workspace.id,
        userId: user.id,
        cursor,
      });

      return c.json({ issues: result.issues, nextCursor: result.nextCursor });
    },
  )
  /**
   * GET /:issueKey - Get an issue by its key.
   */
  .get(
    "/:issueKey",
    describeRoute({
      tags: ["Issues"],
      summary: "Get an issue by key",
      responses: {
        200: {
          description: "Issue details",
          content: { "application/json": { schema: resolver(issueResponseSchema) } },
        },
        404: { description: "Issue not found" },
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

      return c.json({ issue });
    },
  )
  /**
   * PATCH /bulk - Update multiple issues at once.
   */
  .patch(
    "/bulk",
    describeRoute({
      tags: ["Issues"],
      summary: "Bulk update issues",
      responses: {
        200: {
          description: "Updated issues",
          content: { "application/json": { schema: resolver(issueListSchema) } },
        },
      },
    }),
    validator("json", bulkUpdateIssuesSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKeys, updates } = c.req.valid("json");

      const updated = await issueService.updateIssuesBulk({
        workspaceId: workspace.id,
        issueKeys,
        userId: user.id,
        updates,
      });

      return c.json({ issues: updated });
    },
  )
  /**
   * PATCH /move - Move issues to a status column and set their sort order.
   */
  .patch(
    "/move",
    describeRoute({
      tags: ["Issues"],
      summary: "Move issues to a column",
      responses: {
        200: {
          description: "Issues moved",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("json", moveIssueSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey, status, previousIssueKey, nextIssueKey } = c.req.valid("json");

      await issueService.moveIssue({
        workspaceId: workspace.id,
        userId: user.id,
        issueKey,
        status,
        previousIssueKey: previousIssueKey ?? null,
        nextIssueKey: nextIssueKey ?? null,
      });

      return c.json({ success: true });
    },
  )
  /**
   * PATCH /:issueKey - Update an existing issue.
   */
  .patch(
    "/:issueKey",
    describeRoute({
      tags: ["Issues"],
      summary: "Update an issue",
      responses: {
        200: {
          description: "Updated issue",
          content: { "application/json": { schema: resolver(issueResponseSchema) } },
        },
      },
    }),
    validator("param", issueParamsSchema),
    validator("json", updateIssueSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");
      const updates = c.req.valid("json");

      const updated = await issueService.updateIssue({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
        updates,
      });

      return c.json({ issue: updated });
    },
  )
  /**
   * DELETE /bulk - Soft delete multiple issues at once.
   */
  .delete(
    "/bulk",
    describeRoute({
      tags: ["Issues"],
      summary: "Bulk delete issues",
      responses: {
        200: {
          description: "Deletion success message",
          content: { "application/json": { schema: resolver(z.object({ message: z.string() })) } },
        },
      },
    }),
    validator("json", bulkDeleteIssuesSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKeys } = c.req.valid("json");

      const issues = await issueService.softDeleteIssuesBulk({
        workspaceId: workspace.id,
        issueKeys,
        userId: user.id,
      });

      return c.json({ message: `${issues.length} issues deleted` });
    },
  )
  /**
   * DELETE /:issueKey - Soft delete an issue.
   */
  .delete(
    "/:issueKey",
    describeRoute({
      tags: ["Issues"],
      summary: "Delete an issue",
      responses: {
        200: {
          description: "Deletion success message",
          content: { "application/json": { schema: resolver(z.object({ message: z.string() })) } },
        },
      },
    }),
    validator("param", issueParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");

      await issueService.deleteIssue({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      return c.json({ message: "Issue deleted" });
    },
  )
  /**
   * POST /:issueKey/labels - Add a label to an issue.
   */
  .post(
    "/:issueKey/labels",
    describeRoute({
      tags: ["Issues"],
      summary: "Add label to issue",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", issueParamsSchema),
    validator("json", z.object({ labelId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");
      const { labelId } = c.req.valid("json");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      await labelService.addLabelToIssue({
        issueId: issue.id,
        labelId,
        workspaceId: workspace.id,
        actorId: user.id,
      });

      return c.json({ success: true });
    },
  )
  /**
   * DELETE /:issueKey/labels/:labelId - Remove a label from an issue.
   */
  .delete(
    "/:issueKey/labels/:labelId",
    describeRoute({
      tags: ["Issues"],
      summary: "Remove label from issue",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", issueParamsSchema.extend({ labelId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey, labelId } = c.req.valid("param");

      const issue = await issueService.getIssueByKey({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
      });

      await labelService.removeLabelFromIssue({
        issueId: issue.id,
        labelId,
        workspaceId: workspace.id,
        actorId: user.id,
      });

      return c.json({ success: true });
    },
  );

export { issueRoutes };
