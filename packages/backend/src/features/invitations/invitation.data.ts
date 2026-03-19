import { eq } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import { add } from "date-fns";
import { randomBytes } from "node:crypto";

function generateInviteCode(length: number = 8): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

async function createInvitation(input: {
  workspaceId: string;
  createdById: string;
  email: string;
}) {
  const [invitation] = await db
    .insert(dbSchema.workspaceInvitation)
    .values({
      workspaceId: input.workspaceId,
      createdById: input.createdById,
      token: generateInviteCode(),
      email: input.email,
      expiresAt: add(new Date(), { days: 7 }),
    })
    .returning();

  return invitation;
}

async function getInvitationByToken(token: string) {
  const invitation = await db.query.workspaceInvitation.findFirst({
    where: { token },
    with: {
      workspace: true,
    },
  });

  return invitation;
}

async function deleteInvitation(invitationId: string) {
  await db
    .delete(dbSchema.workspaceInvitation)
    .where(eq(dbSchema.workspaceInvitation.id, invitationId));
}

export const invitationData = {
  createInvitation,
  getInvitationByToken,
  deleteInvitation,
};
