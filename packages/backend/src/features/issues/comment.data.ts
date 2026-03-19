import { eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db, dbSchema } from "@blackwall/database";
import type { Issue } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

export async function createComment(input: {
  issue: Issue;
  authorId: string;
  content: JSONContent;
}) {
  const comment = await db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(dbSchema.issueComment)
      .values({
        issueId: input.issue.id,
        authorId: input.authorId,
        content: input.content,
      })
      .returning();

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.authorId,
        },
        "comment_added",
        comment.id,
      ),
    );

    return comment;
  });

  return comment;
}

export async function getCommentById(input: { commentId: string; issueId: string }) {
  return db.query.issueComment.findFirst({
    where: {
      id: input.commentId,
      issueId: input.issueId,
      deletedAt: { isNull: true },
    },
  });
}

export async function getCommentWithAuthorAndIssue(commentId: string) {
  return db.query.issueComment.findFirst({
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

export async function softDeleteComment(input: {
  commentId: string;
  issue: Issue;
  actorId: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(dbSchema.issueComment)
      .set({ deletedAt: new Date() })
      .where(eq(dbSchema.issueComment.id, input.commentId));

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issue.id,
          workspaceId: input.issue.workspaceId,
          actorId: input.actorId,
        },
        "comment_deleted",
        input.commentId,
      ),
    );
  });
}

export const commentData = {
  createComment,
  getCommentById,
  getCommentWithAuthorAndIssue,
  softDeleteComment,
};
