import { and, eq, isNull } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import type { Issue } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

export async function createOrphanAttachment(input: {
  userId: string;
  filePath: string;
  mimeType: string;
  originalFileName: string;
}) {
  const [attachment] = await db
    .insert(dbSchema.issueAttachment)
    .values({
      issueId: null,
      createdById: input.userId,
      filePath: input.filePath,
      mimeType: input.mimeType,
      originalFileName: input.originalFileName,
    })
    .returning();

  return attachment;
}

export async function createAttachment(input: {
  issue: Issue;
  userId: string;
  filePath: string;
  mimeType: string;
  originalFileName: string;
}) {
  return await db.transaction(async (tx) => {
    const [attachment] = await tx
      .insert(dbSchema.issueAttachment)
      .values({
        issueId: input.issue.id,
        createdById: input.userId,
        filePath: input.filePath,
        mimeType: input.mimeType,
        originalFileName: input.originalFileName,
      })
      .returning();

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.userId,
        },
        "attachment_added",
        attachment.id,
      ),
    );

    return attachment;
  });
}

export async function associateAttachmentsWithIssue(input: {
  userId: string;
  issue: Issue;
  attachmentIds: string[];
}) {
  if (input.attachmentIds.length === 0) return;

  await db.transaction(async (tx) => {
    for (const attachmentId of input.attachmentIds) {
      const [updated] = await tx
        .update(dbSchema.issueAttachment)
        .set({ issueId: input.issue.id })
        .where(
          and(
            eq(dbSchema.issueAttachment.id, attachmentId),
            eq(dbSchema.issueAttachment.createdById, input.userId),
            isNull(dbSchema.issueAttachment.issueId),
          ),
        )
        .returning();

      if (updated) {
        await tx.insert(dbSchema.issueChangeEvent).values(
          buildChangeEvent(
            {
              issueId: input.issue.id,
              workspaceId: input.issue.workspaceId,
              actorId: input.userId,
            },
            "attachment_added",
            attachmentId,
          ),
        );
      }
    }
  });
}

export async function getAttachmentById(input: { attachmentId: string; issueId: string }) {
  return db.query.issueAttachment.findFirst({
    where: {
      id: input.attachmentId,
      issueId: input.issueId,
    },
  });
}

export async function getAttachmentForServing(input: { userId: string; attachmentId: string }) {
  const attachment = await db.query.issueAttachment.findFirst({
    where: { id: input.attachmentId },
    with: {
      issue: {
        with: {
          workspace: {
            with: {
              users: true,
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    return null;
  }

  // Orphan attachment - only owner can access
  if (!attachment.issue) {
    if (attachment.createdById !== input.userId) {
      return null;
    }
    return attachment;
  }

  // Check user is member of workspace
  const isMember = attachment.issue.workspace?.users.some((user) => user.id === input.userId);

  if (!isMember) {
    return null;
  }

  return attachment;
}

export async function deleteAttachment(input: {
  attachmentId: string;
  issue: Issue;
  actorId: string;
}) {
  await db.transaction(async (tx) => {
    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.actorId,
        },
        "attachment_removed",
        input.attachmentId,
      ),
    );

    await tx
      .delete(dbSchema.issueAttachment)
      .where(eq(dbSchema.issueAttachment.id, input.attachmentId));
  });
}

export const attachmentData = {
  createOrphanAttachment,
  createAttachment,
  associateAttachmentsWithIssue,
  getAttachmentById,
  getAttachmentForServing,
  deleteAttachment,
};
