import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { Hono } from "hono";
import { auth } from "./better-auth";
import { workspaceService } from "../workspaces/workspace.service";
import { teamService } from "../teams/team.service";
import { signupEmailSchema, signupResponseSchema } from "./auth.zod";

/**
 * We're wrapping better-auth signup here so we can create a workspace and team
 * without mangling with better-auth hooks, which were not designed for dealing
 * with additional input data that is not part of the user object.
 */
const authRoutes = new Hono().post(
  "/signup/email",
  describeRoute({
    tags: ["Auth"],
    summary: "Sign up with email",
    responses: {
      200: {
        description: "User, workspace and team created",
        content: { "application/json": { schema: resolver(signupResponseSchema) } },
      },
    },
  }),
  validator("json", signupEmailSchema),
  async (c) => {
    const { email, password, name, workspaceDisplayName, workspaceUrlSlug } = c.req.valid("json");

    const { headers, response } = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
      headers: c.req.header(),
      returnHeaders: true,
    });

    const workspace = await workspaceService.createWorkspace({
      displayName: workspaceDisplayName,
      slug: workspaceUrlSlug,
    });

    const team = await teamService.createTeamBasedOnWorkspace({
      workspace,
    });

    await Promise.all([
      workspaceService.UNCHECKED_addUserToWorkspace({
        workspaceId: workspace.id,
        userId: response.user.id,
      }),
      teamService.UNCHECKED_addUserToTeam({
        teamId: team.id,
        userId: response.user.id,
      }),
    ]);

    const setCookie = headers.get("Set-Cookie");
    if (setCookie) {
      c.header("Set-Cookie", setCookie);
    }

    return c.json({
      user: response.user,
      workspace,
      team,
    });
  },
);

export { authRoutes };
