import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import { settingsService } from "./settings.service";
import {
  updateProfileNameSchema,
  changePasswordSchema,
  updatePreferredThemeSchema,
  updatePreferredLocaleSchema,
  updateWorkspaceSettingsSchema,
  teamKeyParamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  removeTeamMemberParamSchema,
  createTeamSettingsSchema,
  profileResponseSchema,
  workspaceResponseSchema,
  teamListSchema,
  teamResponseSchema,
  teamWithMembersSchema,
  userListSchema,
} from "./settings.zod";
import { workspaceService } from "../workspaces/workspace.service";
import { HTTPException } from "hono/http-exception";
import { teamData } from "../teams/team.data";
import { teamService } from "../teams/team.service";

const settingsRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * GET /profile - Get the current user's profile.
   */
  .get(
    "/profile",
    describeRoute({
      tags: ["Settings"],
      summary: "Get profile",
      responses: {
        200: {
          description: "User profile",
          content: { "application/json": { schema: resolver(profileResponseSchema) } },
        },
      },
    }),
    async (c) => {
      const user = c.get("user")!;
      const profile = await settingsService.getProfile(user.id);

      if (!profile) {
        return c.notFound();
      }

      return c.json({ profile });
    },
  )
  /**
   * PATCH /profile - Update the current user's profile name.
   */
  .patch(
    "/profile",
    describeRoute({
      tags: ["Settings"],
      summary: "Update profile name",
      responses: {
        200: {
          description: "User profile",
          content: { "application/json": { schema: resolver(profileResponseSchema) } },
        },
      },
    }),
    validator("json", updateProfileNameSchema),
    async (c) => {
      const user = c.get("user")!;
      const { name } = c.req.valid("json");

      const profile = await settingsService.updateProfileName({
        userId: user.id,
        name,
      });

      return c.json({ profile });
    },
  )
  /**
   * PATCH /profile/avatar - Update or remove the current user's avatar.
   */
  .patch("/profile/avatar", async (c) => {
    const user = c.get("user")!;
    const formData = await c.req.formData();
    const intent = formData.get("intent") as string | null;
    const file = formData.get("file") as File | null;

    const currentUser = await settingsService.getProfile(user.id);
    if (!currentUser) {
      throw new HTTPException(404, { message: "User not found" });
    }

    if (intent === "remove") {
      const profile = await settingsService.updateProfileAvatar({
        userId: user.id,
        image: null,
        currentImage: currentUser.image,
      });

      return c.json({ profile });
    }

    if (!file || file.size === 0) {
      throw new HTTPException(400, { message: "No avatar file provided" });
    }

    if (!file.type.startsWith("image/")) {
      throw new HTTPException(400, { message: "Only image files are supported" });
    }

    const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      throw new HTTPException(400, { message: "Image must be smaller than 5MB" });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const profile = await settingsService.updateProfileAvatar({
      userId: user.id,
      image: dataUrl,
      currentImage: currentUser.image,
    });

    return c.json({ profile });
  })
  /**
   * PATCH /profile/theme - Update the current user's preferred theme.
   */
  .patch("/profile/theme", validator("json", updatePreferredThemeSchema), async (c) => {
    const user = c.get("user")!;
    const { theme } = c.req.valid("json");

    await settingsService.updatePreferredTheme({
      userId: user.id,
      theme,
    });

    return c.json({ theme });
  })
  /**
   * PATCH /profile/locale - Update the current user's preferred locale override.
   */
  .patch("/profile/locale", validator("json", updatePreferredLocaleSchema), async (c) => {
    const user = c.get("user")!;
    const { locale } = c.req.valid("json");

    await settingsService.updatePreferredLocale({
      userId: user.id,
      locale,
    });

    return c.json({ locale });
  })
  /**
   * POST /profile/password - Change the current user's password.
   */
  .post(
    "/profile/password",
    describeRoute({
      tags: ["Settings"],
      summary: "Change password",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("json", changePasswordSchema),
    async (c) => {
      const { currentPassword, newPassword, revokeOtherSessions } = c.req.valid("json");

      try {
        await settingsService.changePassword({
          headers: c.req.raw.headers,
          currentPassword,
          newPassword,
          revokeOtherSessions,
        });

        return c.json({ success: true });
      } catch {
        throw new HTTPException(400, { message: "Failed to change password" });
      }
    },
  )
  /**
   * GET /workspace - Get the current workspace settings.
   */
  .get(
    "/workspace",
    describeRoute({
      tags: ["Settings"],
      summary: "Get workspace settings",
      responses: {
        200: {
          description: "Workspace settings",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");

      return c.json({ workspace });
    },
  )
  /**
   * PATCH /workspace - Update the current workspace settings.
   */
  .patch(
    "/workspace",
    describeRoute({
      tags: ["Settings"],
      summary: "Update workspace settings",
      responses: {
        200: {
          description: "Workspace settings",
          content: { "application/json": { schema: resolver(workspaceResponseSchema) } },
        },
      },
    }),
    validator("json", updateWorkspaceSettingsSchema),
    async (c) => {
      const user = c.get("user")!;
      const workspace = c.get("workspace");
      const { displayName } = c.req.valid("json");

      if (displayName) {
        const updatedWorkspace = await workspaceService.updateWorkspace({
          actorId: user.id,
          workspaceId: workspace.id,
          displayName,
        });

        return c.json({ workspace: updatedWorkspace });
      }

      return c.json({ workspace });
    },
  )
  /**
   * GET /teams - List all teams in the workspace with member counts.
   */
  .get(
    "/teams",
    describeRoute({
      tags: ["Settings"],
      summary: "List teams",
      responses: {
        200: {
          description: "List of teams",
          content: { "application/json": { schema: resolver(teamListSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");
      const teamsData = await teamData.listTeamsWithCounts({ workspaceId: workspace.id });
      return c.json({ teams: teamsData });
    },
  )
  /**
   * POST /teams - Create a new team in the workspace.
   */
  .post(
    "/teams",
    describeRoute({
      tags: ["Settings"],
      summary: "Create team",
      responses: {
        200: {
          description: "Created team",
          content: { "application/json": { schema: resolver(teamResponseSchema) } },
        },
      },
    }),
    validator("json", createTeamSettingsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { name, key } = c.req.valid("json");

      const team = await teamService.createTeam({
        name,
        key,
        workspaceId: workspace.id,
      });

      await teamService.UNCHECKED_addUserToTeam({
        teamId: team.id,
        userId: user.id,
      });

      return c.json({ team });
    },
  )
  /**
   * GET /teams/:teamKey - Get a team by its key with members.
   */
  .get(
    "/teams/:teamKey",
    describeRoute({
      tags: ["Settings"],
      summary: "Get team by key",
      responses: {
        200: {
          description: "Team details",
          content: { "application/json": { schema: resolver(teamWithMembersSchema) } },
        },
      },
    }),
    validator("param", teamKeyParamSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { teamKey } = c.req.valid("param");

      const team = await teamData.getTeamByKey({
        workspaceId: workspace.id,
        teamKey,
      });

      if (!team) {
        throw new HTTPException(404, { message: "Team not found" });
      }

      const teamMembers = await teamData.listTeamUsers({
        workspaceId: workspace.id,
        teamKey,
      });

      return c.json({ team, teamMembers });
    },
  )
  /**
   * PATCH /teams/:teamKey - Update a team's settings.
   */
  .patch(
    "/teams/:teamKey",
    describeRoute({
      tags: ["Settings"],
      summary: "Update team",
      responses: {
        200: {
          description: "Updated team",
          content: { "application/json": { schema: resolver(teamResponseSchema) } },
        },
      },
    }),
    validator("param", teamKeyParamSchema),
    validator("json", updateTeamSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { teamKey } = c.req.valid("param");
      const updates = c.req.valid("json");

      const team = await teamData.updateTeam({
        workspaceId: workspace.id,
        teamKey,
        updates,
      });

      if (!team) {
        throw new HTTPException(404, { message: "Team not found" });
      }

      return c.json({ team });
    },
  )
  /**
   * GET /teams/:teamKey/available-users - List workspace users not in a team.
   */
  .get(
    "/teams/:teamKey/available-users",
    describeRoute({
      tags: ["Settings"],
      summary: "Get available users for team",
      responses: {
        200: {
          description: "Available users",
          content: { "application/json": { schema: resolver(userListSchema) } },
        },
      },
    }),
    validator("param", teamKeyParamSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { teamKey } = c.req.valid("param");

      const users = await teamData.listWorkspaceUsersNotInTeam({
        workspaceId: workspace.id,
        teamKey,
      });

      return c.json({ users });
    },
  )
  /**
   * POST /teams/:teamKey/members - Add a member to a team.
   */
  .post(
    "/teams/:teamKey/members",
    describeRoute({
      tags: ["Settings"],
      summary: "Add team member",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", teamKeyParamSchema),
    validator("json", addTeamMemberSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { teamKey } = c.req.valid("param");
      const { userId } = c.req.valid("json");

      const team = await teamData.getTeamByKey({
        workspaceId: workspace.id,
        teamKey,
      });

      if (!team) {
        throw new HTTPException(404, { message: "Team not found" });
      }

      await teamService.addUserToTeam({
        actorId: user.id,
        teamId: team.id,
        userId,
      });

      return c.json({ success: true });
    },
  )
  /**
   * DELETE /teams/:teamKey/members/:userId - Remove a member from a team.
   */
  .delete(
    "/teams/:teamKey/members/:userId",
    describeRoute({
      tags: ["Settings"],
      summary: "Remove team member",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", removeTeamMemberParamSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { teamKey, userId } = c.req.valid("param");

      const team = await teamData.getTeamByKey({
        workspaceId: workspace.id,
        teamKey,
      });

      if (!team) {
        throw new HTTPException(404, { message: "Team not found" });
      }

      await teamData.removeUserFromTeam({
        teamId: team.id,
        userId,
      });

      return c.json({ success: true });
    },
  );

export { settingsRoutes };
