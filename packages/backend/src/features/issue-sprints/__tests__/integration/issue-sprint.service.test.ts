import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import { createIssue, createIssueSprint, seedTestSetup } from "../../../../test/fixtures";
import { issueSprintService } from "../../issue-sprint.service";
import { dbSchema } from "@blackwall/database";
import { eq } from "drizzle-orm";
import { BadRequestError } from "../../../../lib/errors";

describe("issueSprintService", () => {
  let testDb: TestDb;
  let workspaceId: string;
  let teamId: string;
  let userId: string;

  beforeEach(async () => {
    testDb = await createTestDb();

    const { workspace, team, user } = await seedTestSetup(testDb);
    workspaceId = workspace.id;
    teamId = team.id;
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestDb(testDb);
  });

  async function markSprintActive(sprintId: string) {
    await testDb.db
      .update(dbSchema.issueSprint)
      .set({ status: "active" })
      .where(eq(dbSchema.issueSprint.id, sprintId));

    await testDb.db
      .update(dbSchema.team)
      .set({ activeSprintId: sprintId })
      .where(eq(dbSchema.team.id, teamId));
  }

  it("starts a planned sprint and marks it active on the team", async () => {
    const sprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Sprint Start",
      status: "planned",
    });

    const startedSprint = await issueSprintService.startSprint({
      sprintId: sprint.id,
      teamId,
      activeSprintId: null,
    });

    const storedTeam = await testDb.db.query.team.findFirst({
      where: { id: teamId },
    });

    expect(startedSprint.status).toBe("active");
    expect(storedTeam?.activeSprintId).toBe(sprint.id);
  });

  it("rejects starting a sprint while another sprint is already active", async () => {
    const activeSprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Active Sprint",
      status: "active",
    });
    const plannedSprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Planned Sprint",
      status: "planned",
    });

    await testDb.db
      .update(dbSchema.team)
      .set({ activeSprintId: activeSprint.id })
      .where(eq(dbSchema.team.id, teamId));

    let error: unknown;
    try {
      await issueSprintService.startSprint({
        sprintId: plannedSprint.id,
        teamId,
        activeSprintId: activeSprint.id,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadRequestError);
  });

  it("completes a sprint by moving unfinished issues to the backlog", async () => {
    const sprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Backlog Sprint",
      status: "active",
    });
    await markSprintActive(sprint.id);

    const activeIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: sprint.id,
      key: "TES-201",
      keyNumber: 201,
      status: "to_do",
      summary: "Active issue",
    });
    const doneIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: sprint.id,
      key: "TES-202",
      keyNumber: 202,
      status: "done",
      summary: "Done issue",
    });

    await issueSprintService.completeSprint({
      sprintId: sprint.id,
      teamId,
      createdById: userId,
      activeSprintId: sprint.id,
      completion: {
        onUndoneIssues: "moveToBacklog",
      },
    });

    const reloadedActiveIssue = await testDb.db.query.issue.findFirst({
      where: { id: activeIssue.id },
    });
    const reloadedDoneIssue = await testDb.db.query.issue.findFirst({
      where: { id: doneIssue.id },
    });
    const completedSprint = await testDb.db.query.issueSprint.findFirst({
      where: { id: sprint.id },
    });
    const team = await testDb.db.query.team.findFirst({
      where: { id: teamId },
    });

    expect(reloadedActiveIssue?.sprintId).toBeNull();
    expect(reloadedDoneIssue?.sprintId).toBe(sprint.id);
    expect(completedSprint?.status).toBe("completed");
    expect(team?.activeSprintId).toBeNull();
  });

  it("completes a sprint by moving unfinished issues to another planned sprint", async () => {
    const activeSprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Active Sprint",
      status: "active",
    });
    const plannedSprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Planned Sprint",
      status: "planned",
    });
    await markSprintActive(activeSprint.id);

    const activeIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: activeSprint.id,
      key: "TES-203",
      keyNumber: 203,
      status: "in_progress",
      summary: "Move me",
    });

    await issueSprintService.completeSprint({
      sprintId: activeSprint.id,
      teamId,
      createdById: userId,
      activeSprintId: activeSprint.id,
      completion: {
        onUndoneIssues: "moveToPlannedSprint",
        targetSprintId: plannedSprint.id,
      },
    });

    const reloadedIssue = await testDb.db.query.issue.findFirst({
      where: { id: activeIssue.id },
    });

    expect(reloadedIssue?.sprintId).toBe(plannedSprint.id);
  });

  it("completes a sprint by creating a new sprint with normalized UTC day boundaries", async () => {
    const activeSprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Active Sprint",
      status: "active",
    });
    await markSprintActive(activeSprint.id);

    const activeIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: activeSprint.id,
      key: "TES-204",
      keyNumber: 204,
      status: "to_do",
      summary: "Carry over",
    });

    await issueSprintService.completeSprint({
      sprintId: activeSprint.id,
      teamId,
      createdById: userId,
      activeSprintId: activeSprint.id,
      completion: {
        onUndoneIssues: "moveToNewSprint",
        newSprint: {
          name: "Next Sprint",
          startDate: "2026-03-10",
          endDate: "2026-03-14",
        },
      },
    });

    const nextSprint = await testDb.db.query.issueSprint.findFirst({
      where: {
        teamId,
        name: "Next Sprint",
      },
    });
    const reloadedIssue = await testDb.db.query.issue.findFirst({
      where: { id: activeIssue.id },
    });
    const team = await testDb.db.query.team.findFirst({
      where: { id: teamId },
    });

    expect(nextSprint).not.toBeNull();
    expect(nextSprint?.status).toBe("planned");
    expect(nextSprint?.startDate.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(nextSprint?.endDate.toISOString()).toBe("2026-03-14T23:59:59.999Z");
    expect(reloadedIssue?.sprintId).toBe(nextSprint?.id);
    expect(team?.activeSprintId).toBeNull();
  });
});
