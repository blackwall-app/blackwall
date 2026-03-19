import { HTTPException } from "hono/http-exception";
import type { JSONContent } from "@tiptap/core";
import { jobService } from "@blackwall/queue";
import { issueData } from "./issue.data";
import { commentData } from "./comment.data";

/**
 * Get an issue by its key or throw a 404 error.
 * @param workspaceId workspace id
 * @param issueKey issue key
 * @returns issue data
 * @throws HTTPException 404 if issue not found
 */
async function getIssueOrThrow(workspaceId: string, issueKey: string) {
  const issue = await issueData.getIssueByKey({ workspaceId, issueKey });
  if (!issue) {
    throw new HTTPException(404, { message: "Issue not found" });
  }
  return issue;
}

/**
 * Create a comment on an issue.
 * @param input workspace id, issue key, user id, and comment content
 * @returns created comment
 */
export async function createComment(input: {
  workspaceId: string;
  issueKey: string;
  userId: string;
  content: JSONContent;
}) {
  const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

  const comment = await commentData.createComment({
    issue,
    authorId: input.userId,
    content: input.content,
  });

  const recipientIds =
    issue.assignedToId && issue.assignedToId !== input.userId ? [issue.assignedToId] : [];

  await jobService.addJob({
    type: "comment-email",
    payload: {
      commentId: comment.id,
      recipientIds,
    },
  });

  return comment;
}

/**
 * Soft delete a comment from an issue.
 * @param input workspace id, issue key, comment id, and user id
 * @throws HTTPException 404 if comment not found
 */
export async function deleteComment(input: {
  workspaceId: string;
  issueKey: string;
  commentId: string;
  userId: string;
}) {
  const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

  const comment = await commentData.getCommentById({
    commentId: input.commentId,
    issueId: issue.id,
  });

  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  await commentData.softDeleteComment({
    commentId: input.commentId,
    issue,
    actorId: input.userId,
  });
}

export const commentService = {
  createComment,
  deleteComment,
};
