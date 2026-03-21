import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { NotFoundError } from "../../../../lib/errors";
import { jobService } from "@blackwall/queue";
import { issueData } from "../../issue.data";
import { commentData } from "../../comment.data";
import { commentService } from "../../comment.service";

describe("commentService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("throws 404 when creating a comment for a missing issue", async () => {
    spyOn(issueData, "getIssueByKey").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await commentService.createComment({
        workspaceId: "ws-1",
        issueKey: "TES-999",
        userId: "user-1",
        content: { type: "doc", content: [] },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).statusCode).toBe(404);
  });

  it("enqueues a comment-email job for the assignee when the commenter is not the assignee", async () => {
    spyOn(issueData, "getIssueByKey").mockResolvedValue({
      id: "issue-1",
      assignedToId: "assignee-id",
    } as any);
    spyOn(commentData, "createComment").mockResolvedValue({ id: "comment-1" } as any);
    const addJobSpy = spyOn(jobService, "addJob").mockResolvedValue({} as any);

    await commentService.createComment({
      workspaceId: "ws-1",
      issueKey: "TES-1",
      userId: "commenter-id",
      content: { type: "doc", content: [] },
    });

    expect(addJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "comment-email",
        payload: expect.objectContaining({ recipientIds: ["assignee-id"] }),
      }),
    );
  });

  it("enqueues a comment-email job with no recipients when the commenter is the assignee", async () => {
    spyOn(issueData, "getIssueByKey").mockResolvedValue({
      id: "issue-1",
      assignedToId: "user-1",
    } as any);
    spyOn(commentData, "createComment").mockResolvedValue({ id: "comment-1" } as any);
    const addJobSpy = spyOn(jobService, "addJob").mockResolvedValue({} as any);

    await commentService.createComment({
      workspaceId: "ws-1",
      issueKey: "TES-1",
      userId: "user-1",
      content: { type: "doc", content: [] },
    });

    expect(addJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ recipientIds: [] }),
      }),
    );
  });

  it("throws 404 when deleting a comment that does not exist", async () => {
    spyOn(issueData, "getIssueByKey").mockResolvedValue({ id: "issue-1" } as any);
    spyOn(commentData, "getCommentById").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await commentService.deleteComment({
        workspaceId: "ws-1",
        issueKey: "TES-1",
        commentId: "missing-comment",
        userId: "user-1",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).statusCode).toBe(404);
  });
});
