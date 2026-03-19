import { env } from "../../lib/zod-env";
import { jobService } from "@blackwall/queue";
import { workspaceData } from "../workspaces/workspace.data";
import { invitationData } from "./invitation.data";

/**
 * Create a new invitation to join a workspace and send an email.
 * @param input workspace id, inviter id, inviter name, and invitee email
 * @returns the invitation and invitation URL
 */
async function createInvitation(input: {
  workspaceId: string;
  inviterId: string;
  inviterName: string;
  email: string;
}) {
  const workspace = await workspaceData.getWorkspaceById(input.workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const invitation = await invitationData.createInvitation({
    workspaceId: input.workspaceId,
    createdById: input.inviterId,
    email: input.email,
  });

  if (!invitation) {
    throw new Error("Failed to create invitation");
  }

  const invitationUrl = `${env.APP_BASE_URL}/invite/${invitation.token}`;

  await jobService.addJob({
    type: "invite-email",
    payload: {
      email: input.email,
      workspaceName: workspace.displayName,
      inviterName: input.inviterName,
      invitationUrl,
    },
  });

  return {
    invitation,
    invitationUrl,
  };
}

/**
 * Get an invitation by its token. Returns null if not found or expired.
 * @param token invitation token
 * @returns invitation data or null
 */
async function getInvitationByToken(token: string) {
  const invitation = await invitationData.getInvitationByToken(token);

  if (!invitation) {
    return null;
  }

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return null;
  }

  return invitation;
}

/**
 * Accept an invitation and add the user to the workspace.
 * @param input invitation token and user id
 * @returns workspace slug
 * @throws Error if invitation not found or expired
 */
async function acceptInvitation(input: { token: string; userId: string; userEmail: string }) {
  const invitation = await getInvitationByToken(input.token);

  if (!invitation) {
    throw new Error("Invitation not found or expired");
  }

  if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address");
  }

  const alreadyMember = await workspaceData.isWorkspaceMember({
    userId: input.userId,
    workspaceId: invitation.workspaceId,
  });

  if (!alreadyMember) {
    await workspaceData.addUserToWorkspace({
      userId: input.userId,
      workspaceId: invitation.workspaceId,
    });
  }

  await invitationData.deleteInvitation(invitation.id);

  return { workspaceSlug: invitation.workspace.slug };
}

/**
 * Delete an invitation by its id.
 * @param invitationId invitation id
 */
async function deleteInvitation(invitationId: string) {
  await invitationData.deleteInvitation(invitationId);
}

export const invitationService = {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  deleteInvitation,
};
