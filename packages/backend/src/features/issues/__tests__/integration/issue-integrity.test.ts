import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import {
  addUserToTeam,
  addUserToWorkspace,
  createIssue,
  createIssueSprint,
  createTeam,
  createWorkspace,
  seedTestSetup,
} from "../../../../test/fixtures";
import { issueData } from "../../issue.data";
import { issueService } from "../../issue.service";
import { labelData } from "../../label.data";
import { globalSearchData } from "../../../global-search/global-search.data";

describe("issue data integrity", () => {
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

  async function createOtherWorkspace() {
    const workspace = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const team = await createTeam(testDb, { workspaceId: workspace.id, key: "TES", name: "Other" });
    await addUserToWorkspace(testDb, { workspaceId: workspace.id, userId });
    await addUserToTeam(testDb, { teamId: team.id, userId });
    return { workspace, team };
  }

  it("bulk updates only touch issues in the current workspace, even when keys repeat", async () => {
    const other = await createOtherWorkspace();
    const ownIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: "TES-1",
      keyNumber: 1,
    });
    const foreignIssue = await createIssue(testDb, {
      workspaceId: other.workspace.id,
      teamId: other.team.id,
      createdById: userId,
      key: "TES-1",
      keyNumber: 1,
    });

    await issueService.updateIssuesBulk({
      workspaceId,
      issueKeys: ["TES-1"],
      userId,
      updates: { status: "done" },
    });
    await issueService.softDeleteIssuesBulk({ workspaceId, issueKeys: ["TES-1"], userId });

    const [own, foreign] = await Promise.all([
      testDb.db.query.issue.findFirst({ where: { id: ownIssue.id } }),
      testDb.db.query.issue.findFirst({ where: { id: foreignIssue.id } }),
    ]);

    expect(own?.status).toBe("done");
    expect(own?.deletedAt).not.toBeNull();
    expect(foreign?.status).toBe("to_do");
    expect(foreign?.deletedAt).toBeNull();
  });

  it("rejects an issue whose workspace doesn't match its team", async () => {
    const other = await createOtherWorkspace();

    await expect(
      createIssue(testDb, { workspaceId: other.workspace.id, teamId, createdById: userId }),
    ).rejects.toThrow();
  });

  it("rejects an issue in a sprint that belongs to another team", async () => {
    const otherTeam = await createTeam(testDb, { workspaceId, key: "OTH", name: "Other team" });
    const otherSprint = await createIssueSprint(testDb, {
      teamId: otherTeam.id,
      createdById: userId,
    });

    await expect(
      createIssue(testDb, { workspaceId, teamId, createdById: userId, sprintId: otherSprint.id }),
    ).rejects.toThrow();
  });

  it("rejects a label from another workspace", async () => {
    const other = await createOtherWorkspace();
    const issue = await createIssue(testDb, { workspaceId, teamId, createdById: userId });
    const foreignLabel = await labelData.createLabel({
      name: "Foreign",
      colorKey: "red",
      workspaceId: other.workspace.id,
    });

    const insertLink = async () =>
      testDb.db
        .insert(dbSchema.labelOnIssue)
        .values({ issueId: issue.id, labelId: foreignLabel!.id, workspaceId });

    await expect(insertLink()).rejects.toThrow();
  });

  it("treats label names as case-insensitive within a workspace", async () => {
    await labelData.createLabel({ name: "Bug", colorKey: "red", workspaceId });

    expect(await labelData.getLabelByName({ name: "BUG", workspaceId })).toBeDefined();
    await expect(
      labelData.createLabel({ name: "bug", colorKey: "blue", workspaceId }),
    ).rejects.toThrow("Label with this name already exists");
  });

  it("deletes a label that is attached to issues and keeps the history event", async () => {
    const issue = await createIssue(testDb, { workspaceId, teamId, createdById: userId });
    const label = await labelData.createLabel({ name: "Temporary", colorKey: "red", workspaceId });
    await labelData.addLabelToIssue({
      issueId: issue.id,
      labelId: label!.id,
      workspaceId,
      actorId: userId,
    });

    await labelData.deleteLabel({ labelId: label!.id, workspaceId });

    const links = await testDb.db.query.labelOnIssue.findMany({ where: { issueId: issue.id } });
    const events = await testDb.db.query.issueChangeEvent.findMany({
      where: { issueId: issue.id, eventType: "label_added" },
    });

    expect(links).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.labelId).toBeNull();
  });

  it("searches description text, not the document markup, and skips deleted issues", async () => {
    const created = await issueData.createIssue({
      workspaceId,
      teamId,
      teamKey: "TES",
      createdById: userId,
      issue: {
        summary: "Login bug",
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Session expires early" }] },
          ],
        },
      },
    });

    const search = (searchTerm: string) =>
      globalSearchData.searchIssues({ searchTerm, workspaceId, teamIds: [teamId] });

    expect((await search("expires")).map((issue) => issue.id)).toEqual([created.id]);
    expect(await search("paragraph")).toHaveLength(0);

    await issueData.updateIssue({
      issueId: created.id,
      workspaceId,
      actorId: userId,
      originalIssue: created,
      updates: {
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Token refresh fails" }] },
          ],
        },
      },
    });

    expect(await search("expires")).toHaveLength(0);
    expect(await search("refresh")).toHaveLength(1);

    await issueData.softDeleteIssue({ issueId: created.id });

    expect(await search("refresh")).toHaveLength(0);
  });
});
