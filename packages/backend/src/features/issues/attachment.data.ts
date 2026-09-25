import { and, eq, isNull } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import type { Issue } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

export async function createOrphanAttachment(input: {
  userId: string;
  filePath: string;
  mimeType: string;
  originalFileName: string;
  sizeBytes: number;
}) {
  const [attachment] = await db
    .insert(dbSchema.issueAttachment)
    .values({
      issueId: null,
      createdById: input.userId,
      filePath: input.filePath,
      mimeType: input.mimeType,
      originalFileName: input.originalFileName,
      sizeBytes: input.sizeBytes,
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
  sizeBytes: number;
}) {
  return await db.transaction((tx) => {
    const [attachment] = tx
      .insert(dbSchema.issueAttachment)
      .values({
        issueId: input.issue.id,
        createdById: input.userId,
        filePath: input.filePath,
        mimeType: input.mimeType,
        originalFileName: input.originalFileName,
        sizeBytes: input.sizeBytes,
      })
      .returning()
      .all();

    tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.userId,
        },
        "attachment_added",
        { attachmentId: attachment.id },
      ),
    ).run();

    return attachment;
  });
}

export async function associateAttachmentsWithIssue(input: {
  userId: string;
  issue: Issue;
  attachmentIds: string[];
}) {
  if (input.attachmentIds.length === 0) return;

  await db.transaction((tx) => {
    for (const attachmentId of input.attachmentIds) {
      const [updated] = tx
        .update(dbSchema.issueAttachment)
        .set({ issueId: input.issue.id })
        .where(
          and(
            eq(dbSchema.issueAttachment.id, attachmentId),
            eq(dbSchema.issueAttachment.createdById, input.userId),
            isNull(dbSchema.issueAttachment.issueId),
          ),
        )
        .returning()
        .all();

      if (updated) {
        tx.insert(dbSchema.issueChangeEvent).values(
          buildChangeEvent(
            {
              issueId: input.issue.id,
              workspaceId: input.issue.workspaceId,
              actorId: input.userId,
            },
            "attachment_added",
            { attachmentId },
          ),
        ).run();
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
  await db.transaction((tx) => {
    tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.actorId,
        },
        "attachment_removed",
        { attachmentId: input.attachmentId },
      ),
    ).run();

    tx
      .delete(dbSchema.issueAttachment)
      .where(eq(dbSchema.issueAttachment.id, input.attachmentId))
      .run();
  });
}

/**
 * Delete an attachment only if it's still not linked to an issue.
 * @returns the deleted attachment, or undefined if it was linked or doesn't exist
 */
export async function deleteOrphanAttachment(input: { attachmentId: string }) {
  const [deleted] = await db
    .delete(dbSchema.issueAttachment)
    .where(
      and(
        eq(dbSchema.issueAttachment.id, input.attachmentId),
        isNull(dbSchema.issueAttachment.issueId),
      ),
    )
    .returning();

  return deleted;
}

export const attachmentData = {
  createOrphanAttachment,
  createAttachment,
  associateAttachmentsWithIssue,
  getAttachmentById,
  getAttachmentForServing,
  deleteAttachment,
  deleteOrphanAttachment,
};
