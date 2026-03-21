import { describeRoute, resolver, validator } from "hono-openapi";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import { invitationService } from "./invitation.service";
import { auth } from "../auth/better-auth";
import { workspaceData } from "../workspaces/workspace.data";
import {
  createInvitationSchema,
  invitationTokenParamsSchema,
  registerAndAcceptInvitationSchema,
  invitationResponseSchema,
  publicInvitationResponseSchema,
  authResponseSchema,
  acceptInvitationResponseSchema,
} from "./invitation.zod";
import { HTTPException } from "hono/http-exception";

/**
 * POST / - Create and send an invitation to join the workspace.
 * Requires auth + workspace context.
 */
const invitationRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  .post(
    "/",
    describeRoute({
      tags: ["Invitations"],
      summary: "Create and send invitation",
      responses: {
        200: {
          description: "Invitation sent",
          content: { "application/json": { schema: resolver(invitationResponseSchema) } },
        },
      },
    }),
    validator("json", createInvitationSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { email } = c.req.valid("json");

      const result = await invitationService.createInvitation({
        workspaceId: workspace.id,
        inviterId: user.id,
        inviterName: user.name,
        email,
      });

      return c.json({
        message: "Invitation sent successfully.",
        invitation: result.invitation,
        invitationUrl: result.invitationUrl,
      });
    },
  );

const publicInvitationRoutes = new Hono<AppEnv>()
  /**
   * GET /:token - Get invitation details by token (public).
   */
  .get(
    "/:token",
    describeRoute({
      tags: ["Invitations"],
      summary: "Get invitation details",
      responses: {
        200: {
          description: "Invitation details",
          content: { "application/json": { schema: resolver(publicInvitationResponseSchema) } },
        },
      },
    }),
    validator("param", invitationTokenParamsSchema),
    async (c) => {
      const { token } = c.req.valid("param");

      const invitation = await invitationService.getInvitationByToken(token);

      if (!invitation) {
        throw new HTTPException(404, { message: "Invitation not found or expired" });
      }

      const session = await auth.api.getSession({ headers: c.req.header() });
      let isMember = false;
      if (session?.user) {
        isMember = await workspaceData.isWorkspaceMember({
          userId: session.user.id,
          workspaceId: invitation.workspaceId,
        });
      }

      return c.json({
        invitation: {
          email: invitation.email,
          isMember,
          workspace: {
            displayName: invitation.workspace.displayName,
            slug: invitation.workspace.slug,
          },
        },
      });
    },
  )
  /**
   * POST /:token/register - Register a new user and accept an invitation.
   */
  .post(
    "/:token/register",
    describeRoute({
      tags: ["Invitations"],
      summary: "Register and accept invitation",
      responses: {
        200: {
          description: "User registered and invitation accepted",
          content: { "application/json": { schema: resolver(authResponseSchema) } },
        },
      },
    }),
    validator("param", invitationTokenParamsSchema),
    validator("json", registerAndAcceptInvitationSchema),
    async (c) => {
      const { token } = c.req.valid("param");
      const { name, password } = c.req.valid("json");

      const invitation = await invitationService.getInvitationByToken(token);

      if (!invitation) {
        throw new HTTPException(404, { message: "Invitation not found or expired" });
      }

      const { response, headers } = await auth.api.signUpEmail({
        body: {
          email: invitation.email,
          name,
          password,
        },
        headers: c.req.header(),
        returnHeaders: true,
      });

      await workspaceData.addUserToWorkspace({
        userId: response.user.id,
        workspaceId: invitation.workspaceId,
      });

      await invitationService.deleteInvitation(invitation.id);

      const setCookie = headers.get("Set-Cookie");
      if (setCookie) {
        c.header("Set-Cookie", setCookie);
      }

      return c.json({
        user: response.user,
        workspaceSlug: invitation.workspace.slug,
      });
    },
  );

/**
 * POST /:token/accept - Accept an invitation for an existing logged-in user.
 * Requires auth only (no workspace context).
 */
const protectedInvitationRoutes = new Hono<AppEnv>().use("*", authMiddleware).post(
  "/:token/accept",
  describeRoute({
    tags: ["Invitations"],
    summary: "Accept invitation (logged in)",
    responses: {
      200: {
        description: "Invitation accepted",
        content: { "application/json": { schema: resolver(acceptInvitationResponseSchema) } },
      },
    },
  }),
  validator("param", invitationTokenParamsSchema),
  async (c) => {
    const user = c.get("user")!;
    const { token } = c.req.valid("param");

    const result = await invitationService.acceptInvitation({
      token,
      userId: user.id,
      userEmail: user.email,
    });

    return c.json({
      message: "Invitation accepted successfully.",
      workspaceSlug: result.workspaceSlug,
    });
  },
);

export { invitationRoutes, publicInvitationRoutes, protectedInvitationRoutes };
