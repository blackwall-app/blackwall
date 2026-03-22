import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import {
  createIssue,
  createIssueSprint,
  createTeam,
  seedTestSetup,
} from "../../../../test/fixtures";
import { issueService } from "../../issue.service";
import { dbSchema } from "@blackwall/database";
import { eq } from "drizzle-orm";
import { BadRequestError, ForbiddenError } from "../../../../lib/errors";

describe("issueService", () => {
  let testDb: TestDb;
  let workspaceId: string;
  let teamId: string;
  let teamKey: string;
  let userId: string;

  beforeEach(async () => {
    testDb = await createTestDb();

    const { workspace, team, user } = await seedTestSetup(testDb);
    workspaceId = workspace.id;
    teamId = team.id;
    teamKey = team.key;
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestDb(testDb);
  });

  async function activateSprint(sprintId: string) {
    await testDb.db
      .update(dbSchema.issueSprint)
      .set({ status: "active" })
      .where(eq(dbSchema.issueSprint.id, sprintId));

    await testDb.db
      .update(dbSchema.team)
      .set({ activeSprintId: sprintId })
      .where(eq(dbSchema.team.id, teamId));
  }

  it("lists issues from the active sprint when requested", async () => {
    const sprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Current Sprint",
      status: "planned",
    });
    await activateSprint(sprint.id);

    const sprintIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: sprint.id,
      key: `${teamKey}-101`,
      keyNumber: 101,
      summary: "Sprint Issue",
    });
    await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: null,
      key: `${teamKey}-102`,
      keyNumber: 102,
      summary: "Backlog Issue",
    });

    const issues = await issueService.listIssuesForTeam({
      workspaceId,
      teamKey,
      userId,
      onlyOnActiveSprint: true,
    });

    expect(issues.issues.map((issue) => issue.id)).toEqual([sprintIssue.id]);
  });

  it("uses the backlog path when withoutSprint is requested, even if a sprint is active", async () => {
    const sprint = await createIssueSprint(testDb, {
      teamId,
      createdById: userId,
      name: "Current Sprint",
      status: "planned",
    });
    await activateSprint(sprint.id);

    await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: sprint.id,
      key: `${teamKey}-103`,
      keyNumber: 103,
      summary: "Sprint Issue",
    });
    const backlogIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      sprintId: null,
      key: `${teamKey}-104`,
      keyNumber: 104,
      summary: "Backlog Issue",
    });

    const issues = await issueService.listIssuesForTeam({
      workspaceId,
      teamKey,
      userId,
      onlyOnActiveSprint: true,
      withoutSprint: true,
    });

    expect(issues.issues.map((issue) => issue.id)).toEqual([backlogIssue.id]);
  });

  it("rejects bulk updates when some issues are outside the user's teams", async () => {
    const accessibleIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-105`,
      keyNumber: 105,
      summary: "Accessible Issue",
    });

    const hiddenTeam = await createTeam(testDb, {
      workspaceId,
      key: "OTH",
      name: "Other Team",
    });
    const inaccessibleIssue = await createIssue(testDb, {
      workspaceId,
      teamId: hiddenTeam.id,
      createdById: userId,
      key: "OTH-106",
      keyNumber: 106,
      summary: "Inaccessible Issue",
    });

    let error: unknown;
    try {
      await issueService.updateIssuesBulk({
        workspaceId,
        issueKeys: [accessibleIssue.key, inaccessibleIssue.key],
        userId,
        updates: {
          status: "done",
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);

    const reloadedIssue = await testDb.db.query.issue.findFirst({
      where: { id: accessibleIssue.id },
    });
    expect(reloadedIssue?.status).toBe("to_do");
  });

  it("rejects moves when a referenced neighbor is outside the user's teams", async () => {
    const movedIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-107`,
      keyNumber: 107,
      summary: "Moved Issue",
      status: "done",
      sortOrder: 65536,
    });
    const accessibleNeighbor = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-108`,
      keyNumber: 108,
      summary: "Accessible Neighbor",
      status: "done",
      sortOrder: 131072,
    });

    const hiddenTeam = await createTeam(testDb, {
      workspaceId,
      key: "HID",
      name: "Hidden Team",
    });
    const inaccessibleIssue = await createIssue(testDb, {
      workspaceId,
      teamId: hiddenTeam.id,
      createdById: userId,
      key: "HID-109",
      keyNumber: 109,
      summary: "Inaccessible Issue",
      status: "done",
      sortOrder: 196608,
    });

    let error: unknown;
    try {
      await issueService.moveIssue({
        workspaceId,
        userId,
        issueKey: movedIssue.key,
        status: "done",
        previousIssueKey: inaccessibleIssue.key,
        nextIssueKey: accessibleNeighbor.key,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);

    const reloadedIssue = await testDb.db.query.issue.findFirst({
      where: { id: movedIssue.id },
    });
    expect(reloadedIssue?.status).toBe("done");
    expect(reloadedIssue?.sortOrder).toBe(65536);
  });

  it("moves an issue by placing it between its neighbors", async () => {
    const leftIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-110`,
      keyNumber: 110,
      summary: "Left Issue",
      status: "done",
      sortOrder: 65536,
    });
    const rightIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-111`,
      keyNumber: 111,
      summary: "Right Issue",
      status: "done",
      sortOrder: 196608,
    });
    const movedIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-112`,
      keyNumber: 112,
      summary: "Moved Issue",
      status: "to_do",
      sortOrder: 0,
    });

    await issueService.moveIssue({
      workspaceId,
      userId,
      issueKey: movedIssue.key,
      status: "done",
      previousIssueKey: leftIssue.key,
      nextIssueKey: rightIssue.key,
    });

    const reloadedIssue = await testDb.db.query.issue.findFirst({
      where: { id: movedIssue.id },
    });

    expect(reloadedIssue?.status).toBe("done");
    expect(reloadedIssue?.sortOrder).toBe(131072);
  });

  it("rebalances the target lane when there is no integer gap left between neighbors", async () => {
    const previousIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-113`,
      keyNumber: 113,
      summary: "Previous Issue",
      status: "in_progress",
      sortOrder: 10,
    });
    const nextIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-114`,
      keyNumber: 114,
      summary: "Next Issue",
      status: "in_progress",
      sortOrder: 11,
    });
    const movedIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-115`,
      keyNumber: 115,
      summary: "Moved Issue",
      status: "to_do",
      sortOrder: 0,
    });

    await issueService.moveIssue({
      workspaceId,
      userId,
      issueKey: movedIssue.key,
      status: "in_progress",
      previousIssueKey: previousIssue.key,
      nextIssueKey: nextIssue.key,
    });

    const refreshedPrevious = await testDb.db.query.issue.findFirst({
      where: { id: previousIssue.id },
    });
    const refreshedNext = await testDb.db.query.issue.findFirst({
      where: { id: nextIssue.id },
    });
    const refreshedMoved = await testDb.db.query.issue.findFirst({
      where: { id: movedIssue.id },
    });

    expect(refreshedPrevious?.sortOrder).toBe(65536);
    expect(refreshedMoved?.sortOrder).toBe(98304);
    expect(refreshedNext?.sortOrder).toBe(131072);
  });

  it("rejects moves without anchors into a non-empty column", async () => {
    const existingIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-116`,
      keyNumber: 116,
      summary: "Existing Issue",
      status: "done",
      sortOrder: 65536,
    });
    const movedIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-117`,
      keyNumber: 117,
      summary: "Moved Issue",
      status: "to_do",
      sortOrder: 0,
    });

    let error: unknown;
    try {
      await issueService.moveIssue({
        workspaceId,
        userId,
        issueKey: movedIssue.key,
        status: existingIssue.status,
        previousIssueKey: null,
        nextIssueKey: null,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadRequestError);
  });
});
