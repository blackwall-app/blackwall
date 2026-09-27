import { eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db, dbSchema, type DbHandle } from "@blackwall/database";
import type { Issue } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

type CommentIssue = Pick<Issue, "id" | "workspaceId">;

export function insertComment(
  tx: DbHandle,
  input: { issue: CommentIssue; authorId: string; content: JSONContent },
) {
  const [comment] = tx
    .insert(dbSchema.issueComment)
    .values({
      issueId: input.issue.id,
      authorId: input.authorId,
      content: input.content,
    })
    .returning()
    .all();

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.authorId,
        },
        "comment_added",
        { commentId: comment.id },
      ),
    )
    .run();

  return comment;
}

export async function getCommentById(
  input: { commentId: string; issueId: string },
  handle: DbHandle,
) {
  return handle.query.issueComment.findFirst({
    where: {
      id: input.commentId,
      issueId: input.issueId,
      deletedAt: { isNull: true },
    },
  });
}

export async function getCommentWithAuthorAndIssue(commentId: string, handle: DbHandle = db) {
  return handle.query.issueComment.findFirst({
    where: {
      id: commentId,
      deletedAt: { isNull: true },
    },
    with: {
      author: true,
      issue: {
        with: {
          workspace: true,
        },
      },
    },
  });
}

export function softDeleteComment(
  tx: DbHandle,
  input: { commentId: string; issue: CommentIssue; actorId: string },
) {
  tx.update(dbSchema.issueComment)
    .set({ deletedAt: new Date() })
    .where(eq(dbSchema.issueComment.id, input.commentId))
    .run();

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.actorId,
        },
        "comment_deleted",
        { commentId: input.commentId },
      ),
    )
    .run();
}

export const commentData = {
  insertComment,
  getCommentById,
  getCommentWithAuthorAndIssue,
  softDeleteComment,
};
