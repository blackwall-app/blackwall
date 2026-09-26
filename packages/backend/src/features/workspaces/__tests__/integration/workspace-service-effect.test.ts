import "../../../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "@blackwall/database/effect";
import { Effect } from "effect";
import { createTestDb, type TestDb } from "../../../../test/setup";
import { buildUser, createUser } from "../../../../test/fixtures";
import { dbSchema } from "@blackwall/database";
import { teamData } from "../../../teams/team.data";
import { workspaceData } from "../../workspace.data";
import { WorkspaceService } from "../../WorkspaceService";

const run = <A, E>(effect: Effect.Effect<A, E, WorkspaceService | Database>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(WorkspaceService.layer), Effect.provide(Database.layer)),
  );

describe("WorkspaceService with a real database", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  test("creates workspace, owner, team, and membership atomically", async () => {
    const owner = await createUser(testDb);
    const { team, workspace } = await run(
      WorkspaceService.use((service) =>
        service.createWorkspace({
          displayName: "Atomic WS",
          ownerId: owner.id,
          slug: "atomicws",
        }),
      ),
    );

    expect(workspace.slug).toBe("atomicws");
    expect(team.workspaceId).toBe(workspace.id);
    expect(team.key).toBe("ATO");
    expect(
      await workspaceData.isWorkspaceMember({ userId: owner.id, workspaceId: workspace.id }),
    ).toBe(true);
    expect(await teamData.isTeamMember({ userId: owner.id, teamId: team.id })).toBe(true);
  });

  test("rejects a duplicate slug with a typed error and keeps the list working", async () => {
    const owner = await createUser(testDb, buildUser({ email: "dup@example.com" }));
    await run(
      WorkspaceService.use((service) =>
        service.createWorkspace({ displayName: "Dup", ownerId: owner.id, slug: "dupws" }),
      ),
    );

    const error = await run(
      Effect.flip(
        WorkspaceService.use((service) =>
          service.createWorkspace({ displayName: "Dup 2", ownerId: owner.id, slug: "dupws" }),
        ),
      ),
    );
    expect(error._tag).toBe("WorkspaceSlugTaken");

    const workspaces = await run(
      WorkspaceService.use((service) => service.listUserWorkspaces({ userId: owner.id })),
    );
    expect(workspaces.map((workspace) => workspace.slug)).toEqual(["dupws"]);

    const teams = await testDb.db.select().from(dbSchema.team);
    expect(teams).toHaveLength(1);
  });

  test("requireWorkspace reports missing workspaces and non-members", async () => {
    const owner = await createUser(testDb);
    const outsider = await createUser(testDb, buildUser({ email: "outsider@example.com" }));

    const missing = await run(
      Effect.flip(WorkspaceService.use((service) => service.requireWorkspace("nope", owner.id))),
    );
    expect(missing._tag).toBe("WorkspaceNotFound");

    await run(
      WorkspaceService.use((service) =>
        service.createWorkspace({ displayName: "Private", ownerId: owner.id, slug: "private" }),
      ),
    );
    const forbidden = await run(
      Effect.flip(
        WorkspaceService.use((service) => service.requireWorkspace("private", outsider.id)),
      ),
    );
    expect(forbidden._tag).toBe("NotWorkspaceMember");
  });
});
