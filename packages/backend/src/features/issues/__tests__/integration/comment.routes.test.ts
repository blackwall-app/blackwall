import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Comment Routes", () => {
  const getCtx = useTestContext();

  const createIssue = async () => {
    const { client, headers, team } = getCtx();
    const res = await client.api.issues.$post(
      {
        json: {
          teamKey: team.key,
          issue: {
            summary: "Test Issue",
            description: {},
            status: "to_do",
            assignedToId: null,
            sprintId: null,
          },
        },
      },
      {
        headers: headers(),
      },
    );
    const json = await res.json();
    return json.issue;
  };

  const createComment = async (
    issueKey: string,
    content: object = { type: "doc", content: [] },
  ) => {
    const { client, headers } = getCtx();
    const res = await client.api.issues[":issueKey"].comments.$post(
      {
        param: { issueKey },
        json: { content },
      },
      {
        headers: headers(),
      },
    );
    return res;
  };

  describe("POST /issues/:issueKey/comments", () => {
    it("should create a comment on an issue", async () => {
      const issue = await createIssue();
      const res = await createComment(issue.key, {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.comment).toHaveProperty("id");
      expect(json.comment.issueId).toBe(issue.id);
    });

    it("should return 404 for non-existent issue", async () => {
      const res = await createComment("NONEXISTENT-999");

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /issues/:issueKey/comments/:commentId", () => {
    it("should delete a comment", async () => {
      const issue = await createIssue();
      const createRes = await createComment(issue.key);
      const createJson = (await createRes.json()) as { comment: { id: string } };

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].comments[":commentId"].$delete(
        {
          param: { issueKey: issue.key, commentId: createJson.comment.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Comment deleted");
    });

    it("should return 404 for non-existent comment", async () => {
      const issue = await createIssue();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].comments[":commentId"].$delete(
        {
          param: { issueKey: issue.key, commentId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].comments[":commentId"].$delete(
        {
          param: { issueKey: "NONEXISTENT-999", commentId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});
