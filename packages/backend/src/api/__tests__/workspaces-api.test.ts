import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { runApi } from "../../test/api";
import {
  addUserToWorkspace,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("workspaces api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie });

  test("rejects requests without a session", async () => {
    const error = await runApi({}, (client) => Effect.flip(client.workspaces.list()));
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("lists only the workspaces the user belongs to", async () => {
    await createWorkspace(testDb, { slug: "other", displayName: "Other" });

    const { workspaces } = await runApi(authed(), (client) => client.workspaces.list());

    expect(workspaces.map((workspace) => workspace.slug)).toEqual([seed.workspace.slug]);
  });

  test("creates a workspace with an owner and a team", async () => {
    const { workspace } = await runApi(authed(), (client) =>
      client.workspaces.create({ payload: { displayName: "Second", slug: "second" } }),
    );

    expect(workspace.slug).toBe("second");
    const membership = await testDb.db.query.workspaceUser.findFirst({
      where: { workspaceId: workspace.id, userId: seed.user.id },
    });
    expect(membership?.role).toBe("owner");
    const teams = await testDb.db.query.team.findMany({ where: { workspaceId: workspace.id } });
    expect(teams.map((team) => team.key)).toEqual(["SEC"]);
  });

  test("rejects a taken slug with a coded conflict", async () => {
    await runApi(authed(), (client) =>
      client.workspaces.create({ payload: { displayName: "Dup", slug: "dup" } }),
    );
    const error = await runApi(authed(), (client) =>
      Effect.flip(client.workspaces.create({ payload: { displayName: "Dup 2", slug: "dup" } })),
    );

    expect(error).toMatchObject({ _tag: "WorkspaceSlugTaken", code: "WORKSPACE_SLUG_TAKEN" });
  });

  test("returns the last visited workspace as preferred", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    await addUserToWorkspace(testDb, { userId: seed.user.id, workspaceId: other.id });

    await runApi(authed(), (client) => client.workspaces.getBySlug({ params: { slug: "other" } }));
    const { workspace } = await runApi(authed(), (client) => client.workspaces.preferred());

    expect(workspace?.slug).toBe("other");
  });

  test("returns no preferred workspace for a user without workspaces", async () => {
    await testDb.db
      .delete(dbSchema.workspaceUser)
      .where(eq(dbSchema.workspaceUser.userId, seed.user.id));

    const { workspace } = await runApi(authed(), (client) => client.workspaces.preferred());

    expect(workspace).toBeNull();
  });

  test("getBySlug tells missing workspaces from ones the user can't see", async () => {
    await createWorkspace(testDb, { slug: "private", displayName: "Private" });

    const missing = await runApi(authed(), (client) =>
      Effect.flip(client.workspaces.getBySlug({ params: { slug: "nope" } })),
    );
    const forbidden = await runApi(authed(), (client) =>
      Effect.flip(client.workspaces.getBySlug({ params: { slug: "private" } })),
    );

    expect(missing._tag).toBe("WorkspaceNotFound");
    expect(forbidden._tag).toBe("NotWorkspaceMember");
  });

  test("updates the display name for members only", async () => {
    const { workspace } = await runApi(authed(), (client) =>
      client.workspaces.update({
        params: { workspaceId: seed.workspace.id },
        payload: { displayName: "Renamed" },
      }),
    );
    expect(workspace.displayName).toBe("Renamed");

    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.workspaces.update({
          params: { workspaceId: other.id },
          payload: { displayName: "Hijacked" },
        }),
      ),
    );
    expect(error._tag).toBe("NotWorkspaceMember");
  });

  test("lists members with their teams in the workspace", async () => {
    const { members } = await runApi(authed(), (client) =>
      client.workspaces.listMembers({ params: { slug: seed.workspace.slug } }),
    );

    expect(members.map((member) => member.id)).toEqual([seed.user.id]);
    expect(members[0]?.teams.map((team) => team.key)).toEqual([seed.team.key]);
    expect(members[0]?.createdAt).toBeInstanceOf(Date);
  });

  test("gets one member and reports unknown ones", async () => {
    const outsider = await createUser(testDb, { email: "outsider@example.com" });

    const { member } = await runApi(authed(), (client) =>
      client.workspaces.getMember({ params: { slug: seed.workspace.slug, userId: seed.user.id } }),
    );
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.workspaces.getMember({
          params: { slug: seed.workspace.slug, userId: outsider.id },
        }),
      ),
    );

    expect(member.email).toBe(seed.user.email);
    expect(error._tag).toBe("MemberNotFound");
  });

  test("hides members of workspaces the user doesn't belong to", async () => {
    await createWorkspace(testDb, { slug: "private", displayName: "Private" });

    const error = await runApi(authed(), (client) =>
      Effect.flip(client.workspaces.listMembers({ params: { slug: "private" } })),
    );

    expect(error._tag).toBe("NotWorkspaceMember");
  });
});
