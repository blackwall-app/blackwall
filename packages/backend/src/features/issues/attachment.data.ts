import { and, eq, isNull } from "drizzle-orm";
import { dbSchema, type DbHandle } from "@blackwall/database";
import type { Issue } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

type AttachmentIssue = Pick<Issue, "id" | "workspaceId">;

type NewAttachment = {
  userId: string;
  filePath: string;
  mimeType: string;
  originalFileName: string;
  sizeBytes: number;
};

export async function insertOrphanAttachment(handle: DbHandle, input: NewAttachment) {
  const [attachment] = await handle
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

export function insertAttachment(tx: DbHandle, input: NewAttachment & { issue: AttachmentIssue }) {
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

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.userId,
        },
        "attachment_added",
        { attachmentId: attachment.id },
      ),
    )
    .run();

  return attachment;
}

/** Links the user's own orphan attachments to the issue. Other ids are skipped. */
export function associateAttachmentsWithIssue(
  tx: DbHandle,
  input: { userId: string; issue: AttachmentIssue; attachmentIds: ReadonlyArray<string> },
) {
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
      tx.insert(dbSchema.issueChangeEvent)
        .values(
          buildChangeEvent(
            {
              issueId: input.issue.id,
              workspaceId: input.issue.workspaceId,
              actorId: input.userId,
            },
            "attachment_added",
            { attachmentId },
          ),
        )
        .run();
    }
  }
}

export async function getAttachmentById(
  input: { attachmentId: string; issueId: string },
  handle: DbHandle,
) {
  return handle.query.issueAttachment.findFirst({
    where: {
      id: input.attachmentId,
      issueId: input.issueId,
    },
  });
}

/**
 * The attachment if the user may download it: orphans only by their uploader,
 * issue attachments by any member of the issue's workspace.
 */
export async function getAttachmentForServing(
  input: { userId: string; attachmentId: string },
  handle: DbHandle,
) {
  const attachment = await handle.query.issueAttachment.findFirst({
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
    return undefined;
  }

  if (!attachment.issue) {
    return attachment.createdById === input.userId ? attachment : undefined;
  }

  const isMember = attachment.issue.workspace?.users.some((user) => user.id === input.userId);
  return isMember ? attachment : undefined;
}

export function deleteAttachment(
  tx: DbHandle,
  input: { attachmentId: string; issue: AttachmentIssue; actorId: string },
) {
  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.actorId,
        },
        "attachment_removed",
        { attachmentId: input.attachmentId },
      ),
    )
    .run();

  tx.delete(dbSchema.issueAttachment)
    .where(eq(dbSchema.issueAttachment.id, input.attachmentId))
    .run();
}

/**
 * Delete an attachment only if it's still not linked to an issue.
 * @returns the deleted attachment, or undefined if it was linked or doesn't exist
 */
export async function deleteOrphanAttachment(input: { attachmentId: string }, handle: DbHandle) {
  const [deleted] = await handle
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
  insertOrphanAttachment,
  insertAttachment,
  associateAttachmentsWithIssue,
  getAttachmentById,
  getAttachmentForServing,
  deleteAttachment,
  deleteOrphanAttachment,
};
