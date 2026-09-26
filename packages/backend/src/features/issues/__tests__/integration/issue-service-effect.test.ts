import "../../../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { AppLayer } from "../../../../lib/effect/runtime";
import { createTeam, createIssue, createUser, seedTestSetup } from "../../../../test/fixtures";
import { createTestDb, type TestDb } from "../../../../test/setup";
import { IssueService } from "../../IssueService";

const run = <A, E>(effect: Effect.Effect<A, E, IssueService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(AppLayer)));

describe("IssueService with a real database", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  test("finds an issue in the user's team", async () => {
    const issue = await createIssue(testDb, {
      key: "TES-1",
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });

    const found = await run(
      IssueService.use((issues) =>
        issues.requireIssueForUser({
          workspaceId: seed.workspace.id,
          issueKey: issue.key,
          userId: seed.user.id,
        }),
      ),
    );

    expect(found.id).toBe(issue.id);
  });

  test("reports missing issues and teams the user isn't on", async () => {
    const outsider = await createUser(testDb, { email: "outsider@example.com" });
    const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: seed.workspace.id });
    const issue = await createIssue(testDb, {
      key: "OTH-1",
      workspaceId: seed.workspace.id,
      teamId: otherTeam.id,
      createdById: seed.user.id,
    });

    const missing = await run(
      Effect.flip(
        IssueService.use((issues) =>
          issues.requireIssueForUser({
            workspaceId: seed.workspace.id,
            issueKey: "TES-999",
            userId: seed.user.id,
          }),
        ),
      ),
    );
    const denied = await run(
      Effect.flip(
        IssueService.use((issues) =>
          issues.requireIssueForUser({
            workspaceId: seed.workspace.id,
            issueKey: issue.key,
            userId: outsider.id,
          }),
        ),
      ),
    );

    expect(missing._tag).toBe("IssueNotFound");
    expect(denied._tag).toBe("TeamNotFoundOrAccessDenied");
  });
});
