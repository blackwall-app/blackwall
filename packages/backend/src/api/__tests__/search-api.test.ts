import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleRequest } from "../../index";
import { env } from "../../lib/env";
import { runApi } from "../../test/api";
import {
  addUserToTeam,
  addUserToWorkspace,
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("search api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const search = (q: string) =>
    runApi(authed(), (client) => client.search.search({ query: { q } }));

  const getRaw = (query: string) =>
    handleRequest(
      new Request(`${env.APP_BASE_URL}/api/search${query}`, {
        headers: { cookie: seed.cookie, [WORKSPACE_SLUG_HEADER]: seed.workspace.slug },
      }),
    );

  test("rejects requests without a session", async () => {
    const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
      Effect.flip(client.search.search({ query: { q: "test" } })),
    );
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("returns empty results when nothing matches", async () => {
    const result = await search("nonexistentterm12345");
    expect(result).toEqual({ issues: [], users: [] });
  });

  test("requires a query between 1 and 200 characters", async () => {
    for (const query of ["", "?q=", `?q=${"a".repeat(201)}`]) {
      const response = await getRaw(query);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect((await getRaw(`?q=${"a".repeat(200)}`)).status).toBe(200);
  });

  test("finds workspace members by name and tags them as users", async () => {
    const outsider = await createUser(testDb, {
      email: "outsider@example.com",
      name: "Test Outsider",
    });
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    await addUserToWorkspace(testDb, { userId: outsider.id, workspaceId: other.id });

    const { users } = await search(seed.user.name.substring(0, 4));

    expect(users.map((user) => user.id)).toEqual([seed.user.id]);
    expect(users[0]).toMatchObject({ type: "user", email: seed.user.email });
    expect(users[0]?.createdAt).toBeInstanceOf(Date);
  });

  test("returns issues only from teams the user belongs to and tags them", async () => {
    const hiddenTeam = await createTeam(testDb, {
      workspaceId: seed.workspace.id,
      key: "HID",
      name: "Hidden Team",
    });
    const visibleIssue = await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: "TES-11",
      keyNumber: 11,
      summary: "Searchable issue",
    });
    await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: hiddenTeam.id,
      createdById: seed.user.id,
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
      workspaceId: seed.workspace.id,
    });

    const result = await search("searchable");

    expect(result.issues.map((issue) => issue.id)).toEqual([visibleIssue.id]);
    expect(result.issues[0]).toMatchObject({ type: "issue", key: "TES-11" });
    expect(result.users.map((user) => user.id)).toEqual([searchableUser.id]);
  });

  test("returns no issues to a user without teams", async () => {
    await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: "TES-1",
      keyNumber: 1,
      summary: "Searchable issue",
    });
    await testDb.db.delete(dbSchema.userTeam).where(eq(dbSchema.userTeam.userId, seed.user.id));

    const { issues } = await search("searchable");

    expect(issues).toEqual([]);
  });

  test("skips issues from other workspaces and deleted issues", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const otherTeam = await createTeam(testDb, { workspaceId: other.id, key: "TES" });
    await addUserToWorkspace(testDb, { userId: seed.user.id, workspaceId: other.id });
    await addUserToTeam(testDb, { userId: seed.user.id, teamId: otherTeam.id });
    await createIssue(testDb, {
      workspaceId: other.id,
      teamId: otherTeam.id,
      createdById: seed.user.id,
      key: "TES-21",
      keyNumber: 21,
      summary: "Searchable elsewhere",
    });
    await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: "TES-22",
      keyNumber: 22,
      summary: "Searchable but deleted",
      deletedAt: new Date(),
    });

    const { issues } = await search("searchable");

    expect(issues).toEqual([]);
  });

  test("matches description text case-insensitively", async () => {
    const issue = await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: "TES-31",
      keyNumber: 31,
      summary: "Login bug",
      descriptionText: "Session expires early",
    });

    const { issues } = await search("EXPIRES");

    expect(issues.map((found) => found.id)).toEqual([issue.id]);
  });

  test("keeps the old JSON shape on the old path", async () => {
    await createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: "TES-41",
      keyNumber: 41,
      summary: "Test issue",
    });

    const response = await getRaw("?q=test");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      issues: [{ key: "TES-41", summary: "Test issue", status: "to_do", type: "issue" }],
      users: [{ id: seed.user.id, name: seed.user.name, image: null, type: "user" }],
    });
  });
});
