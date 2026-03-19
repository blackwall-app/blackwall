import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import {
  addUserToWorkspace,
  createIssue,
  createTeam,
  createUser,
  seedTestSetup,
} from "../../../../test/fixtures";
import { globalSearchService } from "../../global-search.service";

describe("globalSearchService", () => {
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

  it("returns issues only from teams the current user belongs to and tags result types", async () => {
    const hiddenTeam = await createTeam(testDb, {
      workspaceId,
      key: "HID",
      name: "Hidden Team",
    });

    const visibleIssue = await createIssue(testDb, {
      workspaceId,
      teamId,
      createdById: userId,
      key: `${teamKey}-11`,
      keyNumber: 11,
      summary: "Searchable issue",
    });

    const hiddenIssue = await createIssue(testDb, {
      workspaceId,
      teamId: hiddenTeam.id,
      createdById: userId,
      key: "HID-12",
      keyNumber: 12,
      summary: "Searchable issue",
    });

    const searchableUser = await createUser(testDb, {
      email: "searchable@example.com",
      name: "Searchable Person",
    });
    await addUserToWorkspace(testDb, {
      userId: searchableUser.id,
      workspaceId,
    });

    const result = await globalSearchService.search({
      searchTerm: "searchable",
      workspaceId,
      userId,
    });

    expect(result.issues.map((issue) => issue.id)).toEqual([visibleIssue.id]);
    expect(result.issues[0]?.type).toBe("issue");
    expect(result.issues.map((issue) => issue.id)).not.toContain(hiddenIssue.id);

    expect(result.users.map((foundUser) => foundUser.id)).toEqual([searchableUser.id]);
    expect(result.users[0]?.type).toBe("user");
  });
});
