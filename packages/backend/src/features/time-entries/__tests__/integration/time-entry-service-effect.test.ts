import "../../../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { AppLayer } from "../../../../lib/effect/runtime";
import { createIssue, seedTestSetup } from "../../../../test/fixtures";
import { createTestDb, type TestDb } from "../../../../test/setup";
import { TimeEntryService } from "../../TimeEntryService";

const run = <A, E>(effect: Effect.Effect<A, E, TimeEntryService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(AppLayer)));

// The HttpApi schema already rejects these payloads, so only callers of the
// service itself can reach the check.
describe("TimeEntryService with a real database", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  test("rejects durations that aren't positive without logging anything", async () => {
    const issue = await createIssue(testDb, {
      key: "TES-1",
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });

    for (const durationMinutes of [0, -5]) {
      const error = await run(
        Effect.flip(
          TimeEntryService.use((timeEntries) =>
            timeEntries.createTimeEntry({
              workspaceId: seed.workspace.id,
              issueKey: issue.key,
              userId: seed.user.id,
              durationMinutes,
            }),
          ),
        ),
      );
      expect(error).toMatchObject({
        _tag: "TimeEntryDurationMustBePositive",
        code: "DURATION_MUST_BE_POSITIVE",
      });
    }

    expect(await testDb.db.query.timeEntry.findMany()).toEqual([]);
  });
});
