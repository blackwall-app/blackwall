import { eq } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import { add } from "date-fns";
import { createHash, randomBytes } from "node:crypto";

function generateInviteCode(length: number = 8): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create an invitation. Only a hash of the token is stored, so the raw token is returned
 * here once for building the invite link.
 */
async function createInvitation(input: {
  workspaceId: string;
  createdById: string;
  email: string;
}) {
  const token = generateInviteCode();

  const [invitation] = await db
    .insert(dbSchema.workspaceInvitation)
    .values({
      workspaceId: input.workspaceId,
      createdById: input.createdById,
      tokenHash: hashInviteToken(token),
      email: input.email,
      expiresAt: add(new Date(), { days: 7 }),
    })
    .returning();

  return invitation ? { invitation, token } : undefined;
}

async function getPendingInvitationByToken(token: string) {
  const invitation = await db.query.workspaceInvitation.findFirst({
    where: { tokenHash: hashInviteToken(token), acceptedAt: { isNull: true } },
    with: {
      workspace: true,
    },
  });

  return invitation;
}

async function markInvitationAccepted(input: { invitationId: string; userId: string }) {
  await db
    .update(dbSchema.workspaceInvitation)
    .set({ acceptedAt: new Date(), acceptedById: input.userId })
    .where(eq(dbSchema.workspaceInvitation.id, input.invitationId));
}

export const invitationData = {
  createInvitation,
  getPendingInvitationByToken,
  markInvitationAccepted,
};
