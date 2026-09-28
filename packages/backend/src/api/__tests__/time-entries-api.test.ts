import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleApiRequest } from "../index";
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

describe("time entries api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;
  let issue: Awaited<ReturnType<typeof createIssue>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
    issue = await createIssue(testDb, {
      key: "TES-1",
      keyNumber: 1,
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const logTime = (issueKey: string, durationMinutes: number, description?: string) =>
    runApi(authed(), (client) =>
      client.timeEntries.create({
        params: { issueKey },
        payload: { durationMinutes, description },
      }),
    );

  const postRaw = (issueKey: string, body: unknown) =>
    handleApiRequest(
      new Request(`${env.APP_BASE_URL}/api/issues/${issueKey}/time-entries`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: seed.cookie,
          [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
        },
        body: JSON.stringify(body),
      }),
    );

  test("rejects requests without a session", async () => {
    const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
      Effect.flip(client.timeEntries.list({ params: { issueKey: issue.key } })),
    );
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("lists nothing and totals zero for an issue without entries", async () => {
    const { entries } = await runApi(authed(), (client) =>
      client.timeEntries.list({ params: { issueKey: issue.key } }),
    );
    const { totalMinutes } = await runApi(authed(), (client) =>
      client.timeEntries.total({ params: { issueKey: issue.key } }),
    );

    expect(entries).toEqual([]);
    expect(totalMinutes).toBe(0);
  });

  test("creates an entry and records a time_logged event", async () => {
    const { entry } = await logTime(issue.key, 45, "Working on feature");

    expect(entry).toMatchObject({
      issueId: issue.id,
      userId: seed.user.id,
      durationMinutes: 45,
      description: "Working on feature",
      deletedAt: null,
    });
    expect(entry.createdAt).toBeInstanceOf(Date);

    const events = await testDb.db.query.issueChangeEvent.findMany({
      where: { issueId: issue.id, eventType: "time_logged" },
    });
    expect(events.map((event) => [event.timeEntryId, event.actorId])).toEqual([
      [entry.id, seed.user.id],
    ]);
  });

  test("creates an entry without a description", async () => {
    const { entry } = await logTime(issue.key, 30);
    expect(entry.description).toBeNull();
  });

  test("lists entries newest first with their author", async () => {
    const { entry: first } = await logTime(issue.key, 30);
    await testDb.db
      .update(dbSchema.timeEntry)
      .set({ createdAt: new Date(Date.now() - 60_000) })
      .where(eq(dbSchema.timeEntry.id, first.id));
    const { entry: second } = await logTime(issue.key, 60);

    const { entries } = await runApi(authed(), (client) =>
      client.timeEntries.list({ params: { issueKey: issue.key } }),
    );

    expect(entries.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(entries[0]?.user).toEqual({ id: seed.user.id, name: seed.user.name, image: null });
    expect(entries[0]?.createdAt).toBeInstanceOf(Date);
  });

  test("totals the minutes logged on the issue", async () => {
    await logTime(issue.key, 30);
    await logTime(issue.key, 60);
    const otherIssue = await createIssue(testDb, {
      key: "TES-2",
      keyNumber: 2,
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });
    await logTime(otherIssue.key, 15);

    const { totalMinutes } = await runApi(authed(), (client) =>
      client.timeEntries.total({ params: { issueKey: issue.key } }),
    );

    expect(totalMinutes).toBe(90);
  });

  test("responds with 201 and the entry on the old path", async () => {
    const response = await postRaw(issue.key, { durationMinutes: 20 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      entry: { durationMinutes: 20, issueId: issue.id, createdAt: expect.any(String) },
    });
  });

  test("rejects durations that aren't positive integers", async () => {
    for (const durationMinutes of [-10, 0, 1.5]) {
      const response = await postRaw(issue.key, { durationMinutes });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    }

    const { totalMinutes } = await runApi(authed(), (client) =>
      client.timeEntries.total({ params: { issueKey: issue.key } }),
    );
    expect(totalMinutes).toBe(0);
  });

  test("deletes an entry so it leaves the list and the total", async () => {
    const { entry } = await logTime(issue.key, 30);
    await logTime(issue.key, 15);

    const result = await runApi(authed(), (client) =>
      client.timeEntries.delete({ params: { issueKey: issue.key, timeEntryId: entry.id } }),
    );
    const { entries } = await runApi(authed(), (client) =>
      client.timeEntries.list({ params: { issueKey: issue.key } }),
    );
    const { totalMinutes } = await runApi(authed(), (client) =>
      client.timeEntries.total({ params: { issueKey: issue.key } }),
    );

    expect(result).toEqual({ success: true });
    expect(entries.map((e) => e.id)).not.toContain(entry.id);
    expect(totalMinutes).toBe(15);
    const row = await testDb.db.query.timeEntry.findFirst({ where: { id: entry.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  test("reports unknown, already deleted, and other issues' entries as not found", async () => {
    const { entry } = await logTime(issue.key, 30);
    const otherIssue = await createIssue(testDb, {
      key: "TES-2",
      keyNumber: 2,
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
    });
    const remove = (issueKey: string, timeEntryId: string) =>
      runApi(authed(), (client) =>
        Effect.flip(client.timeEntries.delete({ params: { issueKey, timeEntryId } })),
      );

    const unknown = await remove(issue.key, "00000000-0000-0000-0000-000000000000");
    const wrongIssue = await remove(otherIssue.key, entry.id);
    await runApi(authed(), (client) =>
      client.timeEntries.delete({ params: { issueKey: issue.key, timeEntryId: entry.id } }),
    );
    const deleted = await remove(issue.key, entry.id);

    for (const error of [unknown, wrongIssue, deleted]) {
      expect(error).toMatchObject({ _tag: "TimeEntryNotFound", code: "TIME_ENTRY_NOT_FOUND" });
    }
  });

  test("reports unknown issues on every endpoint", async () => {
    const issueKey = "NON-EXISTENT";
    const errors = await runApi(authed(), (client) =>
      Effect.all([
        Effect.flip(client.timeEntries.list({ params: { issueKey } })),
        Effect.flip(client.timeEntries.total({ params: { issueKey } })),
        Effect.flip(
          client.timeEntries.create({ params: { issueKey }, payload: { durationMinutes: 30 } }),
        ),
        Effect.flip(
          client.timeEntries.delete({
            params: { issueKey, timeEntryId: "00000000-0000-0000-0000-000000000000" },
          }),
        ),
      ]),
    );

    for (const error of errors) {
      expect(error).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
    }
  });

  test("keeps entries on other teams' issues out of reach", async () => {
    const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: seed.workspace.id });
    const teammate = await createUser(testDb, { email: "teammate@example.com" });
    await addUserToWorkspace(testDb, { userId: teammate.id, workspaceId: seed.workspace.id });
    await addUserToTeam(testDb, { userId: teammate.id, teamId: otherTeam.id });
    const hiddenIssue = await createIssue(testDb, {
      key: "OTH-1",
      keyNumber: 1,
      workspaceId: seed.workspace.id,
      teamId: otherTeam.id,
      createdById: teammate.id,
    });
    const [hiddenEntry] = await testDb.db
      .insert(dbSchema.timeEntry)
      .values({ issueId: hiddenIssue.id, userId: teammate.id, durationMinutes: 30 })
      .returning();

    const issueKey = hiddenIssue.key;
    const errors = await runApi(authed(), (client) =>
      Effect.all([
        Effect.flip(client.timeEntries.list({ params: { issueKey } })),
        Effect.flip(client.timeEntries.total({ params: { issueKey } })),
        Effect.flip(
          client.timeEntries.create({ params: { issueKey }, payload: { durationMinutes: 30 } }),
        ),
        Effect.flip(
          client.timeEntries.delete({ params: { issueKey, timeEntryId: hiddenEntry.id } }),
        ),
      ]),
    );

    for (const error of errors) {
      expect(error).toMatchObject({
        _tag: "TeamNotFoundOrAccessDenied",
        code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED",
      });
    }
    const entries = await testDb.db.query.timeEntry.findMany({
      where: { issueId: hiddenIssue.id },
    });
    expect(entries).toEqual([hiddenEntry]);
  });

  test("keeps issues in other workspaces out of reach", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
    const otherIssue = await createIssue(testDb, {
      key: "OTH-1",
      keyNumber: 1,
      workspaceId: other.id,
      teamId: otherTeam.id,
      createdById: seed.user.id,
    });

    const viaOwnWorkspace = await runApi(authed(), (client) =>
      Effect.flip(client.timeEntries.list({ params: { issueKey: otherIssue.key } })),
    );
    const viaOtherWorkspace = await runApi(
      { cookie: seed.cookie, workspaceSlug: other.slug },
      (client) => Effect.flip(client.timeEntries.list({ params: { issueKey: otherIssue.key } })),
    );

    expect(viaOwnWorkspace).toMatchObject({ _tag: "IssueNotFound" });
    expect(viaOtherWorkspace).toMatchObject({
      _tag: "NotWorkspaceMember",
      code: "NOT_WORKSPACE_MEMBER",
    });
  });

  test("requires the workspace header", async () => {
    const error = await runApi({ cookie: seed.cookie }, (client) =>
      Effect.flip(client.timeEntries.list({ params: { issueKey: issue.key } })),
    );
    expect(error).toMatchObject({
      _tag: "MissingWorkspaceHeader",
      code: "MISSING_WORKSPACE_HEADER",
    });
  });
});
