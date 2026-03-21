import { describeRoute, resolver, validator } from "hono-openapi";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceService } from "./workspace.service";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdParamsSchema,
  workspaceSlugParamsSchema,
  workspaceMemberParamsSchema,
  workspaceListSchema,
  workspaceResponseSchema,
  workspaceMemberListSchema,
  workspaceMemberResponseSchema,
} from "./workspace.zod";
import { ErrorCode } from "@blackwall/shared";
import { NotFoundError } from "../../lib/errors";
import { teamService } from "../teams/team.service";

const workspaceRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  /**
   * GET / - List all workspaces the user belongs to.
   */
  .get(
    "/",
    describeRoute({
      tags: ["Workspaces"],
      summary: "List user workspaces",
      responses: {
        200: {
          description: "List of workspaces",
          content: { "application/json": { schema: resolver(workspaceListSchema) } },
        },
      },
    }),
    async (c) => {
      const workspaces = await workspaceService.listUserWorkspaces({
        userId: c.get("user")!.id,
      });

      return c.json({ workspaces });
    },
  )
  /**
   * POST /create - Create a new workspace and adjacent team. Adds current user to the new workspace and team.
   */
  .post(
    "/create",
    describeRoute({
      tags: ["Workspaces"],
      summary: "Create workspace",
      responses: {
        200: {
          description: "Created workspace",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    validator("json", createWorkspaceSchema),
    async (c) => {
      const workspace = await workspaceService.createWorkspace(c.req.valid("json"));
      await workspaceService.UNCHECKED_addUserToWorkspace({
        userId: c.get("user")!.id,
        workspaceId: workspace.id,
      });

      const team = await teamService.createTeamBasedOnWorkspace({ workspace });
      await teamService.UNCHECKED_addUserToTeam({
        userId: c.get("user")!.id,
        teamId: team.id,
      });

      return c.json({ workspace });
    },
  )

  /**
   * GET /preferred - Get the user's preferred workspace.
   */
  .get(
    "/preferred",
    describeRoute({
      tags: ["Workspaces"],
      summary: "Get preferred workspace",
      responses: {
        200: {
          description: "Preferred workspace",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    async (c) => {
      const user = c.get("user")!;
      const workspace = await workspaceService.getPreferredWorkspaceForUser({ user });

      return c.json({ workspace });
    },
  )

  /**
   * GET /:slug - Get a workspace by its slug.
   */
  .get(
    "/:slug",
    describeRoute({
      tags: ["Workspaces"],
      summary: "Get workspace by slug",
      responses: {
        200: {
          description: "Workspace details",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    async (c) => {
      const { slug } = c.req.param();
      const user = c.get("user")!;

      const workspace = await workspaceService.getWorkspaceBySlug(slug, user.id);

      await workspaceService.saveLastWorkspaceForUser({
        userId: user.id,
        workspaceId: workspace.id,
      });

      return c.json({ workspace: workspace });
    },
  )

  /**
   * PATCH /:workspaceId - Update a workspace's settings.
   */
  .patch(
    "/:workspaceId",
    describeRoute({
      tags: ["Workspaces"],
      summary: "Update workspace",
      responses: {
        200: {
          description: "Updated workspace",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    validator("param", workspaceIdParamsSchema),
    validator("json", updateWorkspaceSchema),
    async (c) => {
      const user = c.get("user")!;
      const { workspaceId } = c.req.valid("param");
      const { displayName } = c.req.valid("json");

      const workspace = await workspaceService.updateWorkspace({
        actorId: user.id,
        workspaceId,
        displayName,
      });

      return c.json({ workspace });
    },
  )

  /**
   * GET /:slug/members - List all members of a workspace.
   */
  .get(
    "/:slug/members",
    describeRoute({
      tags: ["Workspaces"],
      summary: "List workspace members",
      responses: {
        200: {
          description: "List of members",
          content: { "application/json": { schema: resolver(workspaceMemberListSchema) } },
        },
      },
    }),
    validator("param", workspaceSlugParamsSchema),
    async (c) => {
      const user = c.get("user")!;
      const { slug } = c.req.valid("param");
      const workspace = await workspaceService.getWorkspaceBySlug(slug, user.id);

      const members = await workspaceService.listWorkspaceMembers({
        actorId: user.id,
        workspaceId: workspace.id,
      });

      return c.json({ members });
    },
  )

  /**
   * GET /:slug/members/:userId - Get a specific member of a workspace.
   */
  .get(
    "/:slug/members/:userId",
    describeRoute({
      tags: ["Workspaces"],
      summary: "Get workspace member",
      responses: {
        200: {
          description: "Member details",
          content: { "application/json": { schema: resolver(workspaceMemberResponseSchema) } },
        },
      },
    }),
    validator("param", workspaceMemberParamsSchema),
    async (c) => {
      const user = c.get("user")!;
      const { slug, userId } = c.req.valid("param");
      const workspace = await workspaceService.getWorkspaceBySlug(slug, user.id);

      const member = await workspaceService.getWorkspaceMember({
        actorId: user.id,
        workspaceId: workspace.id,
        userId,
      });

      if (!member) {
        throw new NotFoundError("Member not found", ErrorCode.MEMBER_NOT_FOUND);
      }

      return c.json({ member });
    },
  );

export { workspaceRoutes };
