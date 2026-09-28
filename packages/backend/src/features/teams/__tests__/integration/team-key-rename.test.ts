import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";
import { Database } from "@blackwall/database/effect";
import { Effect } from "effect";
import { TeamService } from "../../TeamService";
import { issueData } from "../../../issues/issue.data";

const run = <A, E>(effect: Effect.Effect<A, E, TeamService | Database>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(TeamService.layer), Effect.provide(Database.layer)));

describe("team key renames", () => {
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

  const renameKey = (teamKey: string, key: string) =>
    run(TeamService.use((teams) => teams.updateTeam({ workspaceId, teamKey, key })));

  async function createIssue(summary: string) {
    return testDb.db.transaction((tx) =>
      issueData.insertIssue(tx, {
        workspaceId,
        teamId,
        teamKey: "TES",
        createdById: userId,
        issue: { summary, description: { type: "doc", content: [] } },
      }),
    );
  }

  it("moves existing issues to the new key and keeps the old key resolvable", async () => {
    const issue = await createIssue("Before rename");
    expect(issue.key).toBe("TES-1");

    await renameKey("TES", "NEW");

    const byNewKey = await issueData.getIssueByKey({ workspaceId, issueKey: "NEW-1" });
    const byOldKey = await issueData.getIssueByKey({ workspaceId, issueKey: "TES-1" });

    expect(byNewKey?.id).toBe(issue.id);
    expect(byOldKey?.id).toBe(issue.id);
    expect(byOldKey?.key).toBe("NEW-1");
  });

  it("lets a new team take a renamed team's old key without colliding with its issues", async () => {
    const oldIssue = await createIssue("Old team issue");
    await renameKey("TES", "NEW");

    const newTeam = await run(
      TeamService.use((teams) => teams.createTeam({ workspaceId, name: "Reuses key", key: "TES" })),
    );
    const newIssue = testDb.db.transaction((tx) =>
      issueData.insertIssue(tx, {
        workspaceId,
        teamId: newTeam.id,
        teamKey: "TES",
        createdById: userId,
        issue: { summary: "New team issue", description: { type: "doc", content: [] } },
      }),
    );

    const resolved = await issueData.getIssueByKey({ workspaceId, issueKey: "TES-1" });

    expect(newIssue.key).toBe("TES-1");
    expect(resolved?.id).toBe(newIssue.id);
    expect(resolved?.id).not.toBe(oldIssue.id);
  });

  it("drops the alias when a team is renamed back to its old key", async () => {
    await createIssue("Round trip");
    await renameKey("TES", "NEW");
    await renameKey("NEW", "TES");

    const aliases = await testDb.db.query.teamKeyAlias.findMany({ where: { teamId } });
    const issue = await issueData.getIssueByKey({ workspaceId, issueKey: "TES-1" });

    expect(aliases.map((alias) => alias.key)).toEqual(["NEW"]);
    expect(issue?.key).toBe("TES-1");
  });
});
