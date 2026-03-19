import "../../../../test/env.test";
import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { dbSchema } from "@blackwall/database";
import { useTestContext } from "../../../../test/context";
import { createIssue } from "../../../../test/fixtures";

describe("Issue Sprint Routes", () => {
  const getCtx = useTestContext();

  const createSprint = async (overrides?: {
    name?: string;
    goal?: string | null;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const { client, headers, team } = getCtx();
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const res = await client.api["issue-sprints"].teams[":teamKey"].sprints.$post(
      {
        param: { teamKey: team.key },
        json: {
          name: overrides?.name ?? "Sprint 1",
          goal: overrides?.goal ?? "Complete the milestone",
          startDate: (overrides?.startDate ?? now).toISOString().slice(0, 10),
          endDate: (overrides?.endDate ?? nextWeek).toISOString().slice(0, 10),
        },
      },
      { headers: headers() },
    );

    const json = (await res.json()) as {
      sprint: { id: string; name: string; goal: string | null; status: string };
    };

    return { res, json };
  };

  const startSprint = async (sprintId: string) => {
    const { client, headers, team } = getCtx();
    return client.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"].start.$post(
      {
        param: { teamKey: team.key, sprintId },
      },
      { headers: headers() },
    );
  };

  describe("POST /issue-sprints/teams/:teamKey/sprints", () => {
    it("should create a planned sprint without activating it", async () => {
      const { res, json } = await createSprint({ name: "Sprint 1", goal: "Ship it" });

      expect(res.status).toBe(201);
      expect(json.sprint.name).toBe("Sprint 1");
      expect(json.sprint.goal).toBe("Ship it");
      expect(json.sprint.status).toBe("planned");

      const { client, headers, team } = getCtx();
      const activeRes = await client.api["issue-sprints"].teams[":teamKey"].sprints.active.$get(
        { param: { teamKey: team.key } },
        { headers: headers() },
      );
      const activeJson = (await activeRes.json()) as { sprint: null };
      expect(activeJson.sprint).toBeNull();
    });
  });

  describe("POST /issue-sprints/teams/:teamKey/sprints/:sprintId/start", () => {
    it("should start a planned sprint", async () => {
      const { json: created } = await createSprint({ name: "Sprint 1" });
      const res = await startSprint(created.sprint.id);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { sprint: { id: string; status: string } };
      expect(json.sprint.id).toBe(created.sprint.id);
      expect(json.sprint.status).toBe("active");
    });

    it("should return 400 if another sprint is already active", async () => {
      const { json: first } = await createSprint({ name: "Sprint 1" });
      const { json: second } = await createSprint({ name: "Sprint 2" });

      const firstStartRes = await startSprint(first.sprint.id);
      expect(firstStartRes.status).toBe(200);

      const secondStartRes = await startSprint(second.sprint.id);
      expect(secondStartRes.status).toBe(400);
    });
  });

  describe("GET /issue-sprints/teams/:teamKey/sprints/:sprintId/complete-context", () => {
    it("should return hasUndoneIssues=true and planned sprints only", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { json: active } = await createSprint({
        name: "Sprint Active",
        startDate: lastWeek,
        endDate: nextWeek,
      });
      const { json: planned } = await createSprint({ name: "Sprint Planned" });
      await startSprint(active.sprint.id);

      await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: active.sprint.id,
        status: "in_progress",
      });
      await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: active.sprint.id,
        status: "done",
      });

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"][
        "complete-context"
      ].$get(
        {
          param: { teamKey: team.key, sprintId: active.sprint.id },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        sprint: { id: string };
        plannedSprints: Array<{ id: string; status: string }>;
        hasUndoneIssues: boolean;
      };
      expect(json.sprint.id).toBe(active.sprint.id);
      expect(json.hasUndoneIssues).toBe(true);
      expect(json.plannedSprints.map((sprint) => sprint.id)).toEqual([planned.sprint.id]);
      expect(json.plannedSprints.every((sprint) => sprint.status === "planned")).toBe(true);
    });

    it("should return hasUndoneIssues=false when sprint has only done issues", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { json: active } = await createSprint({
        name: "Sprint Active",
        startDate: lastWeek,
        endDate: nextWeek,
      });
      await startSprint(active.sprint.id);

      await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: active.sprint.id,
        status: "done",
      });

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"][
        "complete-context"
      ].$get(
        {
          param: { teamKey: team.key, sprintId: active.sprint.id },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { hasUndoneIssues: boolean };
      expect(json.hasUndoneIssues).toBe(false);
    });
  });

  describe("POST /issue-sprints/teams/:teamKey/sprints/:sprintId/complete", () => {
    it("should return 400 when completing a non-active sprint", async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { json: created } = await createSprint({
        name: "Sprint 1",
        startDate: lastWeek,
        endDate: yesterday,
      });

      const { client, headers, team } = getCtx();
      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(400);
    });

    it("should complete an active sprint and move undone issues to backlog", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { json: created } = await createSprint({
        name: "Sprint 1",
        startDate: lastWeek,
        endDate: yesterday,
      });

      await startSprint(created.sprint.id);

      const todoIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: created.sprint.id,
        status: "to_do",
      });
      const doneIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: created.sprint.id,
        status: "done",
      });

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);

      const [todoUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, todoIssue.id));
      const [doneUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, doneIssue.id));

      expect(todoUpdated.sprintId).toBeNull();
      expect(doneUpdated.sprintId).toBe(created.sprint.id);

      const [sprint] = await testDb.db
        .select()
        .from(dbSchema.issueSprint)
        .where(eq(dbSchema.issueSprint.id, created.sprint.id));
      expect(sprint.status).toBe("completed");
      expect(sprint.finishedAt).not.toBeNull();
    });

    it("should allow completing an active sprint even when end date is in the future", async () => {
      const { client, headers, team, testDb } = getCtx();
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { json: created } = await createSprint({
        name: "Sprint Future End Date",
        startDate: yesterday,
        endDate: nextWeek,
      });

      await startSprint(created.sprint.id);

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);

      const [sprint] = await testDb.db
        .select()
        .from(dbSchema.issueSprint)
        .where(eq(dbSchema.issueSprint.id, created.sprint.id));
      expect(sprint.status).toBe("completed");
      expect(sprint.finishedAt).not.toBeNull();
    });

    it("should move undone issues to a specific planned sprint", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { json: active } = await createSprint({
        name: "Sprint Active",
        startDate: lastWeek,
        endDate: yesterday,
      });
      const { json: planned } = await createSprint({
        name: "Sprint Planned",
      });

      await startSprint(active.sprint.id);

      const todoIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: active.sprint.id,
        status: "to_do",
      });

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: active.sprint.id },
          json: {
            onUndoneIssues: "moveToPlannedSprint",
            targetSprintId: planned.sprint.id,
          },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);

      const [todoUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, todoIssue.id));
      expect(todoUpdated.sprintId).toBe(planned.sprint.id);
    });

    it("should create a new planned sprint and move undone issues when configured", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { json: active } = await createSprint({
        name: "Sprint Active",
        startDate: lastWeek,
        endDate: yesterday,
      });
      await startSprint(active.sprint.id);

      const todoIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: active.sprint.id,
        status: "in_progress",
      });

      const res = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: active.sprint.id },
          json: {
            onUndoneIssues: "moveToNewSprint",
            newSprint: {
              name: "Sprint Next",
              startDate: now.toISOString().slice(0, 10),
              endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10),
            },
          },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);

      const [todoUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, todoIssue.id));

      expect(todoUpdated.sprintId).not.toBeNull();

      const movedSprint = await testDb.db.query.issueSprint.findFirst({
        where: { id: todoUpdated.sprintId! },
      });
      expect(movedSprint).not.toBeNull();
      expect(movedSprint!.name).toBe("Sprint Next");
      expect(movedSprint!.status).toBe("planned");
    });
  });

  describe("Completed sprint behavior", () => {
    it("should reject update/start/complete for completed sprint", async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { json: created } = await createSprint({
        name: "Sprint 1",
        startDate: lastWeek,
        endDate: yesterday,
      });

      await startSprint(created.sprint.id);

      const { client, headers, team } = getCtx();
      const completeRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );
      expect(completeRes.status).toBe(200);

      const updateRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].$patch(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: {
            name: "Updated",
            goal: null,
            startDate: lastWeek.toISOString().slice(0, 10),
            endDate: yesterday.toISOString().slice(0, 10),
          },
        },
        { headers: headers() },
      );
      expect(updateRes.status).toBe(400);

      const startRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].start.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
        },
        { headers: headers() },
      );
      expect(startRes.status).toBe(400);

      const reCompleteRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );
      expect(reCompleteRes.status).toBe(400);
    });
  });

  describe("Sprint archive", () => {
    it("should archive a completed sprint and hide it from sprint list", async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { json: created } = await createSprint({
        name: "Sprint 1",
        startDate: lastWeek,
        endDate: yesterday,
      });

      await startSprint(created.sprint.id);

      const { client, headers, team, testDb } = getCtx();
      const completeRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].complete.$post(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
          json: { onUndoneIssues: "moveToBacklog" },
        },
        { headers: headers() },
      );
      expect(completeRes.status).toBe(200);

      const archiveRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].$delete(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
        },
        { headers: headers() },
      );
      expect(archiveRes.status).toBe(200);

      const [archived] = await testDb.db
        .select()
        .from(dbSchema.issueSprint)
        .where(eq(dbSchema.issueSprint.id, created.sprint.id));
      expect(archived.archivedAt).not.toBeNull();

      const listRes = await client.api["issue-sprints"].teams[":teamKey"].sprints.$get(
        { param: { teamKey: team.key } },
        { headers: headers() },
      );
      const listJson = (await listRes.json()) as { sprints: Array<{ id: string }> };
      expect(listJson.sprints.find((sprint) => sprint.id === created.sprint.id)).toBeUndefined();
    });

    it("should archive non-active sprint and keep done issues assigned", async () => {
      const { testDb, team, user, workspace, client, headers } = getCtx();
      const { json: created } = await createSprint({
        name: "Sprint 1",
      });

      const todoIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: created.sprint.id,
        status: "to_do",
      });
      const doneIssue = await createIssue(testDb, {
        teamId: team.id,
        createdById: user.id,
        workspaceId: workspace.id,
        sprintId: created.sprint.id,
        status: "done",
      });

      const archiveRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].$delete(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
        },
        { headers: headers() },
      );
      expect(archiveRes.status).toBe(200);

      const [todoUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, todoIssue.id));
      const [doneUpdated] = await testDb.db
        .select()
        .from(dbSchema.issue)
        .where(eq(dbSchema.issue.id, doneIssue.id));

      expect(todoUpdated.sprintId).toBeNull();
      expect(doneUpdated.sprintId).toBe(created.sprint.id);
    });

    it("should reject archiving an active sprint", async () => {
      const { json: created } = await createSprint({ name: "Sprint 1" });
      await startSprint(created.sprint.id);

      const { client, headers, team } = getCtx();
      const archiveRes = await client.api["issue-sprints"].teams[":teamKey"].sprints[
        ":sprintId"
      ].$delete(
        {
          param: { teamKey: team.key, sprintId: created.sprint.id },
        },
        { headers: headers() },
      );

      expect(archiveRes.status).toBe(400);
    });
  });
});
