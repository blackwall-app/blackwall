import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";
import { createIssue } from "../../../../test/fixtures";

describe("Time Entry Routes", () => {
  const getCtx = useTestContext();

  const createTestIssue = async () => {
    const { testDb, workspace, team, user } = getCtx();
    return createIssue(testDb, {
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      key: "TES-1",
      keyNumber: 1,
      summary: "Test Issue",
    });
  };

  const createTimeEntry = async (
    issueId: string,
    issueKey: string,
    data?: { duration?: number; description?: string },
  ) => {
    const { client, headers } = getCtx();
    return client.api["time-entries"].issues[":issueKey"]["time-entries"].$post(
      {
        param: { issueKey },
        json: {
          duration: data?.duration ?? 30,
          description: data?.description,
        },
      },
      { headers: headers() },
    );
  };

  describe("GET /time-entries/issues/:issueId/time-entries", () => {
    it("should return empty array when no time entries exist", async () => {
      const issue = await createTestIssue();
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$get(
        { param: { issueKey: issue.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { entries: unknown[] };
      expect(json.entries).toHaveLength(0);
    });

    it("should return list of time entries for issue", async () => {
      const issue = await createTestIssue();
      await createTimeEntry(issue.id, issue.key, { duration: 30 });
      await createTimeEntry(issue.id, issue.key, { duration: 60 });

      const { client, headers } = getCtx();
      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$get(
        { param: { issueKey: issue.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { entries: unknown[] };
      expect(json.entries).toHaveLength(2);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();
      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$get(
        { param: { issueKey: "NON-EXISTENT" } },
        { headers: headers() },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /time-entries/issues/:issueId/time-entries/total", () => {
    it("should return 0 when no time entries exist", async () => {
      const issue = await createTestIssue();
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].total.$get(
        { param: { issueKey: issue.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { totalMinutes: number };
      expect(json.totalMinutes).toBe(0);
    });

    it("should return total time logged", async () => {
      const issue = await createTestIssue();
      await createTimeEntry(issue.id, issue.key, { duration: 30 });
      await createTimeEntry(issue.id, issue.key, { duration: 60 });

      const { client, headers } = getCtx();
      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].total.$get(
        { param: { issueKey: issue.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { totalMinutes: number };
      expect(json.totalMinutes).toBe(90);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();
      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].total.$get(
        { param: { issueKey: "NON-EXISTENT" } },
        { headers: headers() },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /time-entries/issues/:issueId/time-entries", () => {
    it("should create a time entry", async () => {
      const issue = await createTestIssue();

      const res = await createTimeEntry(issue.id, issue.key, {
        duration: 45,
        description: "Working on feature",
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { entry: { duration: number; description: string } };
      expect(json.entry.duration).toBe(45);
      expect(json.entry.description).toBe("Working on feature");
    });

    it("should return 400 for invalid duration", async () => {
      const issue = await createTestIssue();
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$post(
        {
          param: { issueKey: issue.key },
          json: {
            duration: -10,
          },
        },
        { headers: headers() },
      );

      // @ts-expect-error test code
      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$post(
        {
          param: { issueKey: "NON-EXISTENT" },
          json: {
            duration: 30,
          },
        },
        { headers: headers() },
      );

      // @ts-expect-error test code
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /time-entries/issues/:issueId/time-entries/:timeEntryId", () => {
    it("should delete a time entry", async () => {
      const issue = await createTestIssue();
      const createRes = await createTimeEntry(issue.id, issue.key, { duration: 30 });
      const createJson = (await createRes.json()) as { entry: { id: string } };

      const { client, headers } = getCtx();
      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"][
        ":timeEntryId"
      ].$delete(
        { param: { issueKey: issue.key, timeEntryId: createJson.entry.id } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);

      const listRes = await client.api["time-entries"].issues[":issueKey"]["time-entries"].$get(
        { param: { issueKey: issue.key } },
        { headers: headers() },
      );
      const listJson = (await listRes.json()) as { entries: unknown[] };
      expect(listJson.entries).toHaveLength(0);
    });

    it("should return 404 for non-existent time entry", async () => {
      const issue = await createTestIssue();
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"][
        ":timeEntryId"
      ].$delete(
        { param: { issueKey: issue.key, timeEntryId: "00000000-0000-0000-0000-000000000000" } },
        { headers: headers() },
      );

      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();

      const res = await client.api["time-entries"].issues[":issueKey"]["time-entries"][
        ":timeEntryId"
      ].$delete(
        {
          param: {
            issueKey: "NON-EXISTENT",
            timeEntryId: "00000000-0000-0000-0000-000000000000",
          },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(404);
    });
  });
});
