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

  const created = await invitationData.createInvitation({
    workspaceId: input.workspaceId,
    createdById: input.inviterId,
    email: input.email,
  });

  if (!created) {
    throw new Error("Failed to create invitation");
  }

  const { tokenHash: _tokenHash, ...invitation } = created.invitation;
  const invitationUrl = `${env.APP_BASE_URL}/invite/${created.token}`;

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
    invitation: { ...invitation, token: created.token },
    invitationUrl,
  };
}

/**
 * Get a pending invitation by its token. Returns null if not found, expired, or already accepted.
 * @param token invitation token
 * @returns invitation data or null
 */
async function getInvitationByToken(token: string) {
  const invitation = await invitationData.getPendingInvitationByToken(token);

  if (!invitation) {
    return null;
  }

  if (invitation.expiresAt < new Date()) {
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

  await invitationData.markInvitationAccepted({
    invitationId: invitation.id,
    userId: input.userId,
  });

  return { workspaceSlug: invitation.workspace.slug };
}

/**
 * Record that an invitation was used. The row is kept so it's clear who joined through it.
 * @param input invitation id and the id of the user who accepted it
 */
async function markInvitationAccepted(input: { invitationId: string; userId: string }) {
  await invitationData.markInvitationAccepted(input);
}

export const invitationService = {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  markInvitationAccepted,
};
