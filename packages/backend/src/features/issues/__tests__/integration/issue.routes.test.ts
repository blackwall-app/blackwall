import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { eq } from "drizzle-orm";
import { useTestContext } from "../../../../test/context";
import { createIssueSprint } from "../../../../test/fixtures";

describe("Issue Routes", () => {
  const getCtx = useTestContext();

  const createIssue = (issue: {
    summary: string;
    description?: object;
    status: "to_do" | "in_progress" | "done";
    assignedToId: string | null;
    sprintId: string | null;
  }) => {
    const { client, headers, team } = getCtx();
    return client.api.issues.$post(
      {
        json: {
          teamKey: team.key,
          issue: {
            description: { type: "doc", content: [] },
            ...issue,
          },
        },
      },
      {
        headers: headers(),
      },
    );
  };

  describe("GET /issues", () => {
    it("should return empty array when no issues exist", async () => {
      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$get(
        {
          query: { teamKey: team.key },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ issues: [], nextCursor: null });
    });

    it("should return list of issues for a team", async () => {
      await createIssue({
        summary: "Test Issue 1",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      await createIssue({
        summary: "Test Issue 2",
        status: "in_progress",
        assignedToId: null,
        sprintId: null,
      });
      await createIssue({
        summary: "Test Issue 3",
        status: "done",
        assignedToId: null,
        sprintId: null,
      });

      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$get(
        {
          query: { teamKey: team.key },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issues).toHaveLength(3);
      expect(json.issues[0].key).toBe("TES-1");
      expect(json.issues[1].key).toBe("TES-2");
      expect(json.issues[2].key).toBe("TES-3");
    });

    it("should filter issues by status", async () => {
      await createIssue({
        summary: "Test Issue 1",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      await createIssue({
        summary: "Test Issue 2",
        status: "in_progress",
        assignedToId: null,
        sprintId: null,
      });
      await createIssue({
        summary: "Test Issue 3",
        status: "done",
        assignedToId: null,
        sprintId: null,
      });

      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$get(
        {
          query: { teamKey: team.key, statusFilters: ["to_do", "done"] },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issues).toHaveLength(2);
      expect(json.issues.map((i: any) => i.status)).toEqual(["to_do", "done"]);
    });

    it("should include assignedTo, labels, and issueSprint relations", async () => {
      await createIssue({
        summary: "Test Issue 1",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });

      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$get(
        {
          query: { teamKey: team.key },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issues[0]).toHaveProperty("assignedTo");
      expect(json.issues[0]).toHaveProperty("labels");
      expect(json.issues[0]).toHaveProperty("issueSprint");
    });

    it("should return 400 when teamKey is missing", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.issues.$get(
        // @ts-expect-error - intentionally missing query.teamKey for validation test
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /issues", () => {
    it("should create a new issue", async () => {
      const res = await createIssue({
        summary: "New Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue).toHaveProperty("id");
      expect(json.issue.summary).toBe("New Test Issue");
      expect(json.issue.key).toMatch(/^TES-\d+$/);
    });

    it("should create issue with assignee", async () => {
      const { user } = getCtx();
      const res = await createIssue({
        summary: "Assigned Issue",
        status: "to_do",
        assignedToId: user.id,
        sprintId: null,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.assignedToId).toBe(user.id);
    });

    it("should create issue with sprint", async () => {
      const { testDb, team, user } = getCtx();
      const sprint = await createIssueSprint(testDb, { teamId: team.id, createdById: user.id });
      const res = await createIssue({
        summary: "Sprinted Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: sprint.id,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.sprintId).toBe(sprint.id);
    });

    it("should return 400 when summary is missing", async () => {
      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$post(
        {
          json: {
            teamKey: team.key,
            // @ts-expect-error - intentionally missing summary for validation test
            issue: {
              description: { type: "doc", content: [] },
              status: "to_do",
            },
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when teamKey is missing", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.issues.$post(
        {
          // @ts-expect-error - intentionally missing teamKey for validation test
          json: {
            issue: {
              summary: "Test Issue",
              description: { type: "doc", content: [] },
              status: "to_do",
            },
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when status is invalid", async () => {
      const { client, headers, team } = getCtx();
      const res = await client.api.issues.$post(
        {
          json: {
            teamKey: team.key,
            issue: {
              summary: "Test Issue",
              description: { type: "doc", content: [] },
              // @ts-expect-error - intentionally invalid status for validation test
              status: "invalid_status",
            },
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /issues/:issueKey", () => {
    it("should return an issue by key", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].$get(
        {
          param: { issueKey: created.issue.key },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.key).toBe(created.issue.key);
      expect(json.issue.summary).toBe("Test Issue");
    });

    it("should include relations", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].$get(
        {
          param: { issueKey: created.issue.key },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue).toHaveProperty("team");
      expect(json.issue).toHaveProperty("comments");
      expect(json.issue).toHaveProperty("changeEvents");
    });
  });

  describe("PATCH /issues/:issueKey", () => {
    it("should update issue status", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].$patch(
        {
          param: { issueKey: created.issue.key },
          json: { status: "in_progress" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.status).toBe("in_progress");
    });

    it("should update issue summary", async () => {
      const createRes = await createIssue({
        summary: "Original Summary",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].$patch(
        {
          param: { issueKey: created.issue.key },
          json: { summary: "Updated Summary" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.summary).toBe("Updated Summary");
    });

    it("should update issue priority", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].$patch(
        {
          param: { issueKey: created.issue.key },
          json: { priority: "high" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.priority).toBe("high");
    });

    it("should update issue assignee", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers, user } = getCtx();
      const res = await client.api.issues[":issueKey"].$patch(
        {
          param: { issueKey: created.issue.key },
          json: { assignedToId: user.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issue.assignedToId).toBe(user.id);
    });
  });

  describe("PATCH /issues/move", () => {
    it("moves an issue into a new status using neighbor anchors", async () => {
      const firstIssueRes = await createIssue({
        summary: "First Issue",
        status: "done",
        assignedToId: null,
        sprintId: null,
      });
      const secondIssueRes = await createIssue({
        summary: "Second Issue",
        status: "done",
        assignedToId: null,
        sprintId: null,
      });
      const movedIssueRes = await createIssue({
        summary: "Moved Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const firstIssue = await firstIssueRes.json();
      const secondIssue = await secondIssueRes.json();
      const movedIssue = await movedIssueRes.json();

      const { client, headers, testDb } = getCtx();
      await testDb.db
        .update(dbSchema.issue)
        .set({ sortOrder: 65536 })
        .where(eq(dbSchema.issue.id, firstIssue.issue.id));
      await testDb.db
        .update(dbSchema.issue)
        .set({ sortOrder: 131072 })
        .where(eq(dbSchema.issue.id, secondIssue.issue.id));

      const res = await client.api.issues.move.$patch(
        {
          json: {
            issueKey: movedIssue.issue.key,
            status: "done",
            previousIssueKey: firstIssue.issue.key,
            nextIssueKey: secondIssue.issue.key,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      const movedIssueAfter = await testDb.db.query.issue.findFirst({
        where: { id: movedIssue.issue.id },
      });
      expect(movedIssueAfter?.status).toBe("done");
      expect(movedIssueAfter?.sortOrder).toBe(98304);
    });

    it("returns 400 when the moved issue is used as its own neighbor", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers } = getCtx();
      const res = await client.api.issues.move.$patch(
        {
          json: {
            issueKey: created.issue.key,
            status: "done",
            previousIssueKey: created.issue.key,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /issues/:issueKey", () => {
    it("should soft delete an issue", async () => {
      const createRes = await createIssue({
        summary: "Test Issue",
        status: "to_do",
        assignedToId: null,
        sprintId: null,
      });
      const created = await createRes.json();

      const { client, headers, team } = getCtx();
      const deleteRes = await client.api.issues[":issueKey"].$delete(
        {
          param: { issueKey: created.issue.key },
        },
        {
          headers: headers(),
        },
      );

      expect(deleteRes.status).toBe(200);
      const deleteJson = await deleteRes.json();
      expect(deleteJson.message).toBe("Issue deleted");

      const listRes = await client.api.issues.$get(
        {
          query: { teamKey: team.key },
        },
        {
          headers: headers(),
        },
      );
      const listJson = await listRes.json();
      expect(listJson.issues).toHaveLength(0);
    });
  });
});
