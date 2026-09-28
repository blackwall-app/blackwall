import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import {
  WORKSPACE_SLUG_HEADER,
  type IssueListQuery,
  type IssueStatus,
  type UpdateIssue,
} from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleEffectRequest } from "../index";
import { labelData } from "../../features/issues/label.data";
import { env } from "../../lib/zod-env";
import { runApi } from "../../test/api";
import {
  addUserToTeam,
  addUserToWorkspace,
  createIssue,
  createIssueSprint,
  createTeam,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("issues api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;
  let nextKeyNumber: number;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
    nextKeyNumber = 100;
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });
  const flip = <A, E>(effect: Effect.Effect<A, E>) => Effect.flip(effect);
  const emptyDoc = { type: "doc", content: [] };

  const create = (
    issue: {
      summary?: string;
      status?: IssueStatus;
      assignedToId?: string | null;
      sprintId?: string | null;
    } = {},
    teamKey = seed.team.key,
  ) =>
    runApi(authed(), (client) =>
      client.issues.create({
        payload: { teamKey, issue: { summary: "Test issue", description: emptyDoc, ...issue } },
      }),
    ).then(({ issue: created }) => created);

  const addIssue = (overrides: Parameters<typeof createIssue>[1] = {}) => {
    const keyNumber = nextKeyNumber++;
    return createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      key: `${seed.team.key}-${keyNumber}`,
      keyNumber,
      ...overrides,
    });
  };

  const addOtherTeamIssue = async (overrides: Parameters<typeof createIssue>[1] = {}) => {
    const other = await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
    return addIssue({ teamId: other.id, key: "OTH-1", keyNumber: 1, ...overrides });
  };

  const listTeam = (query: Omit<IssueListQuery, "teamKey"> = {}) =>
    runApi(authed(), (client) =>
      client.issues.list({ query: { teamKey: seed.team.key, ...query } }),
    );

  const loadIssue = async (id: string) => {
    const [row] = await testDb.db.select().from(dbSchema.issue).where(eq(dbSchema.issue.id, id));
    return row;
  };

  const loadEvents = (issueId: string) =>
    testDb.db.query.issueChangeEvent.findMany({
      where: { issueId },
      orderBy: { createdAt: "asc" },
    });

  const activateSprint = async () => {
    const sprint = await createIssueSprint(testDb, {
      teamId: seed.team.id,
      createdById: seed.user.id,
    });
    await testDb.db
      .update(dbSchema.issueSprint)
      .set({ status: "active" })
      .where(eq(dbSchema.issueSprint.id, sprint.id));
    return sprint;
  };

  const createLabel = (name: string, workspaceId = seed.workspace.id) =>
    labelData.insertLabel(testDb.db, { name, colorKey: "red", workspaceId })!;

  const sendRaw = (method: string, path: string, body?: unknown) =>
    handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect/issues${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          cookie: seed.cookie,
          [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  test("rejects requests without a session", async () => {
    const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
      flip(client.issues.my({ query: {} })),
    );
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("rejects workspaces the user doesn't belong to", async () => {
    const other = await createWorkspace(testDb, { slug: "other" });
    const error = await runApi({ cookie: seed.cookie, workspaceSlug: other.slug }, (client) =>
      flip(client.issues.my({ query: {} })),
    );
    expect(error).toMatchObject({ _tag: "NotWorkspaceMember", code: "NOT_WORKSPACE_MEMBER" });
  });

  describe("list", () => {
    test("returns an empty page when the team has no issues", async () => {
      expect(await listTeam()).toEqual({ issues: [], nextCursor: null });
    });

    test("lists the team's issues in creation order with their relations", async () => {
      await create({ summary: "One" });
      await create({ summary: "Two", status: "in_progress", assignedToId: seed.user.id });
      await create({ summary: "Three", status: "done" });

      const { issues, nextCursor } = await listTeam();

      expect(nextCursor).toBeNull();
      expect(issues.map((issue) => issue.key)).toEqual(["TES-1", "TES-2", "TES-3"]);
      expect(issues[1]).toMatchObject({
        assignedTo: { id: seed.user.id },
        labels: [],
        issueSprint: null,
        team: { key: seed.team.key },
      });
      expect(issues[0]!.createdAt).toBeInstanceOf(Date);
      expect(issues[0]).not.toHaveProperty("description");
    });

    test("filters by status", async () => {
      await create({ status: "to_do" });
      await create({ status: "in_progress" });
      await create({ status: "done" });

      const { issues } = await listTeam({ statusFilters: ["to_do", "done"] });
      expect(issues.map((issue) => issue.status)).toEqual(["to_do", "done"]);

      const response = await sendRaw("GET", `?teamKey=${seed.team.key}&statusFilters=done`);
      expect(response.status).toBe(200);
      const json = (await response.json()) as { issues: Array<{ status: string }> };
      expect(json.issues.map((issue) => issue.status)).toEqual(["done"]);
    });

    test("pages with a cursor, or returns everything without pagination", async () => {
      for (let i = 0; i < 3; i++) await create();

      const first = await listTeam({ limit: 2 });
      expect(first.issues).toHaveLength(2);
      expect(first.nextCursor).toBe(first.issues[1]!.id);

      const second = await listTeam({ limit: 2, cursor: first.nextCursor! });
      expect(second.issues.map((issue) => issue.key)).toEqual(["TES-3"]);
      expect(second.nextCursor).toBeNull();

      const all = await listTeam({ limit: 1, pagination: false });
      expect(all.issues).toHaveLength(3);
      expect(all.nextCursor).toBeNull();
    });

    test("lists the active sprint's issues, unless the backlog is requested", async () => {
      const sprint = await activateSprint();
      const sprintIssue = await addIssue({ sprintId: sprint.id });
      const backlogIssue = await addIssue();

      const active = await listTeam({ onlyOnActiveSprint: true });
      const backlog = await listTeam({ onlyOnActiveSprint: true, withoutSprint: true });

      expect(active.issues.map((issue) => issue.id)).toEqual([sprintIssue.id]);
      expect(active.issues[0]!.issueSprint).toMatchObject({ id: sprint.id });
      expect(backlog.issues.map((issue) => issue.id)).toEqual([backlogIssue.id]);
    });

    test("hides teams the user doesn't belong to", async () => {
      await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
      const error = await runApi(authed(), (client) =>
        flip(client.issues.list({ query: { teamKey: "OTH" } })),
      );
      expect(error).toMatchObject({
        _tag: "TeamNotFoundOrAccessDenied",
        code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED",
      });
    });

    test("rejects a missing team key", async () => {
      const response = await sendRaw("GET", "");
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("create", () => {
    test("creates an issue with the team's next key and records the event", async () => {
      const issue = await create({ summary: "New issue" });

      expect(issue).toMatchObject({
        key: "TES-1",
        summary: "New issue",
        status: "to_do",
        priority: "medium",
        createdById: seed.user.id,
        assignedToId: null,
      });
      expect((await loadEvents(issue.id)).map((event) => event.eventType)).toEqual([
        "issue_created",
      ]);
      expect((await create()).key).toBe("TES-2");
    });

    test("sets the assignee and sprint", async () => {
      const sprint = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
      });
      const issue = await create({ assignedToId: seed.user.id, sprintId: sprint.id });

      expect(issue.assignedToId).toBe(seed.user.id);
      expect(issue.sprintId).toBe(sprint.id);
    });

    test("only creates issues in the user's teams", async () => {
      await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.create({
            payload: { teamKey: "OTH", issue: { summary: "Nope", description: emptyDoc } },
          }),
        ),
      );
      expect(error).toMatchObject({ code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED" });
    });

    test("rejects invalid payloads", async () => {
      const bodies = [
        { teamKey: "TES", issue: { description: emptyDoc, status: "to_do" } },
        { issue: { summary: "No team", description: emptyDoc } },
        { teamKey: "TES", issue: { summary: "", description: emptyDoc } },
        { teamKey: "TES", issue: { summary: "Bad", description: emptyDoc, status: "nope" } },
        { teamKey: "TES", issue: { summary: "Bad", description: { type: "nope" } } },
      ];
      for (const body of bodies) {
        const response = await sendRaw("POST", "", body);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
      }
    });
  });

  describe("my", () => {
    test("lists the issues assigned to the user across teams", async () => {
      const other = await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
      await addUserToTeam(testDb, { teamId: other.id, userId: seed.user.id });
      const mine = await addIssue({ assignedToId: seed.user.id });
      const otherTeamIssue = await addIssue({
        teamId: other.id,
        key: "OTH-1",
        keyNumber: 1,
        assignedToId: seed.user.id,
      });
      await addIssue();

      const { issues, nextCursor } = await runApi(authed(), (client) =>
        client.issues.my({ query: {} }),
      );

      expect(nextCursor).toBeNull();
      expect(issues.map((issue) => issue.id).sort()).toEqual([mine.id, otherTeamIssue.id].sort());
      expect(issues.find((issue) => issue.id === otherTeamIssue.id)?.team?.key).toBe("OTH");
    });
  });

  describe("get", () => {
    test("returns the issue with its team, comments, and activity", async () => {
      const created = await create({ summary: "Detailed", assignedToId: seed.user.id });
      await runApi(authed(), (client) =>
        client.comments.create({
          params: { issueKey: created.key },
          payload: {
            content: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
            },
          },
        }),
      );
      await runApi(authed(), (client) =>
        client.issues.update({ params: { issueKey: created.key }, payload: { priority: "high" } }),
      );

      const { issue } = await runApi(authed(), (client) =>
        client.issues.get({ params: { issueKey: created.key } }),
      );

      expect(issue).toMatchObject({
        key: created.key,
        summary: "Detailed",
        description: emptyDoc,
        assignedTo: { id: seed.user.id, name: seed.user.name },
        team: { key: seed.team.key, name: seed.team.name },
        labels: [],
        issueSprint: null,
      });
      expect(issue.comments).toHaveLength(1);
      expect(issue.comments[0]!.author.id).toBe(seed.user.id);
      expect(issue.changeEvents.map((event) => event.eventType)).toEqual([
        "issue_created",
        "comment_added",
        "priority_changed",
      ]);
      expect(issue.changeEvents[2]).toMatchObject({
        actor: { id: seed.user.id },
        changes: { priority: { from: "medium", to: "high" } },
      });
    });

    test("resolves a key the team used before a rename", async () => {
      const created = await create();
      await runApi(authed(), (client) =>
        client.settings.updateTeam({ params: { teamKey: seed.team.key }, payload: { key: "NEW" } }),
      );

      const { issue } = await runApi(authed(), (client) =>
        client.issues.get({ params: { issueKey: created.key } }),
      );
      expect(issue.key).toBe("NEW-1");
    });

    test("reports missing issues and issues of other teams", async () => {
      const hidden = await addOtherTeamIssue();

      const missing = await runApi(authed(), (client) =>
        flip(client.issues.get({ params: { issueKey: "TES-999" } })),
      );
      const denied = await runApi(authed(), (client) =>
        flip(client.issues.get({ params: { issueKey: hidden.key } })),
      );

      expect(missing).toMatchObject({ _tag: "IssueNotFound", code: "ISSUE_NOT_FOUND" });
      expect(denied).toMatchObject({ code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED" });
    });

    test("doesn't find issues of another workspace", async () => {
      const workspace = await createWorkspace(testDb, { slug: "other" });
      const team = await createTeam(testDb, { workspaceId: workspace.id, key: "TES" });
      await addUserToWorkspace(testDb, { workspaceId: workspace.id, userId: seed.user.id });
      await addUserToTeam(testDb, { teamId: team.id, userId: seed.user.id });
      await createIssue(testDb, {
        workspaceId: workspace.id,
        teamId: team.id,
        createdById: seed.user.id,
        key: "TES-1",
        keyNumber: 1,
      });

      const error = await runApi(authed(), (client) =>
        flip(client.issues.get({ params: { issueKey: "TES-1" } })),
      );
      expect(error).toMatchObject({ code: "ISSUE_NOT_FOUND" });
    });
  });

  describe("update", () => {
    test("updates fields and records what changed", async () => {
      const created = await create();

      const update = (payload: UpdateIssue) =>
        runApi(authed(), (client) =>
          client.issues.update({ params: { issueKey: created.key }, payload }),
        ).then(({ issue }) => issue);

      expect((await update({ status: "in_progress" })).status).toBe("in_progress");
      expect((await update({ summary: "Renamed" })).summary).toBe("Renamed");
      expect((await update({ priority: "urgent" })).priority).toBe("urgent");
      expect((await update({ assignedToId: seed.user.id })).assignedToId).toBe(seed.user.id);
      expect((await update({ estimationPoints: 5 })).estimationPoints).toBe(5);
      await update({ status: "in_progress" });

      const events = await loadEvents(created.id);
      expect(events.map((event) => event.eventType)).toEqual([
        "issue_created",
        "status_changed",
        "summary_changed",
        "priority_changed",
        "assignee_changed",
        "issue_updated",
      ]);
      expect(events[1]!.changes).toEqual({ status: { from: "to_do", to: "in_progress" } });
    });

    test("updates the description and its search text", async () => {
      const created = await create();
      const description = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "New text" }] }],
      };

      await runApi(authed(), (client) =>
        client.issues.update({ params: { issueKey: created.key }, payload: { description } }),
      );

      const row = await loadIssue(created.id);
      expect(row?.description).toEqual(description);
      expect(row?.descriptionText).toBe("New text");
      expect((await loadEvents(created.id)).at(-1)?.eventType).toBe("description_changed");
    });

    test("rejects invalid updates", async () => {
      const created = await create();
      for (const body of [{ summary: "" }, { estimationPoints: 0 }, { status: "nope" }]) {
        const response = await sendRaw("PATCH", `/${created.key}`, body);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
      }
    });

    test("only updates issues of the user's teams", async () => {
      const hidden = await addOtherTeamIssue();
      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.update({ params: { issueKey: hidden.key }, payload: { status: "done" } }),
        ),
      );
      expect(error).toMatchObject({ code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED" });
      expect((await loadIssue(hidden.id))?.status).toBe("to_do");
    });
  });

  describe("bulk update", () => {
    test("updates every issue and records an event for each", async () => {
      const first = await create();
      const second = await create({ status: "done" });

      const { issues } = await runApi(authed(), (client) =>
        client.issues.bulkUpdate({
          payload: { issueKeys: [first.key, second.key], updates: { status: "done" } },
        }),
      );

      expect(issues.map((issue) => issue.status)).toEqual(["done", "done"]);
      expect((await loadEvents(first.id)).at(-1)?.eventType).toBe("status_changed");
      expect((await loadEvents(second.id)).at(-1)?.eventType).toBe("issue_created");
    });

    test("changes nothing when some issues are outside the user's teams", async () => {
      const accessible = await create();
      const hidden = await addOtherTeamIssue();

      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.bulkUpdate({
            payload: { issueKeys: [accessible.key, hidden.key], updates: { status: "done" } },
          }),
        ),
      );

      expect(error).toMatchObject({ _tag: "IssuesNotAccessible", code: "ISSUES_NOT_ACCESSIBLE" });
      expect((await loadIssue(accessible.id))?.status).toBe("to_do");
    });

    test("treats unknown keys as inaccessible", async () => {
      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.bulkUpdate({
            payload: { issueKeys: ["TES-404"], updates: { status: "done" } },
          }),
        ),
      );
      expect(error).toMatchObject({ code: "ISSUES_NOT_ACCESSIBLE" });
    });
  });

  describe("move", () => {
    const move = (payload: {
      issueKey: string;
      status: IssueStatus;
      previousIssueKey?: string | null;
      nextIssueKey?: string | null;
    }) => runApi(authed(), (client) => client.issues.move({ payload }));

    const moveError = (payload: {
      issueKey: string;
      status: IssueStatus;
      previousIssueKey?: string | null;
      nextIssueKey?: string | null;
    }) => runApi(authed(), (client) => flip(client.issues.move({ payload })));

    test("places the issue between its neighbors in the new column", async () => {
      const left = await addIssue({ status: "done", sortOrder: 65536 });
      const right = await addIssue({ status: "done", sortOrder: 196608 });
      const moved = await addIssue({ status: "to_do" });

      expect(
        await move({
          issueKey: moved.key,
          status: "done",
          previousIssueKey: left.key,
          nextIssueKey: right.key,
        }),
      ).toEqual({ success: true });

      expect(await loadIssue(moved.id)).toMatchObject({ status: "done", sortOrder: 131072 });
    });

    test("moves into an empty column without neighbors", async () => {
      const moved = await addIssue({ status: "to_do" });
      await move({ issueKey: moved.key, status: "in_progress" });
      expect(await loadIssue(moved.id)).toMatchObject({ status: "in_progress", sortOrder: 65536 });
    });

    test("rebalances the column when there's no gap between the neighbors", async () => {
      const previous = await addIssue({ status: "in_progress", sortOrder: 10 });
      const next = await addIssue({ status: "in_progress", sortOrder: 11 });
      const moved = await addIssue({ status: "to_do" });

      await move({
        issueKey: moved.key,
        status: "in_progress",
        previousIssueKey: previous.key,
        nextIssueKey: next.key,
      });

      expect((await loadIssue(previous.id))?.sortOrder).toBe(65536);
      expect((await loadIssue(moved.id))?.sortOrder).toBe(98304);
      expect((await loadIssue(next.id))?.sortOrder).toBe(131072);
    });

    test("rejects the issue as its own neighbor", async () => {
      const moved = await addIssue();
      const response = await sendRaw("PATCH", "/move", {
        issueKey: moved.key,
        status: "done",
        previousIssueKey: moved.key,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });

    test("rejects the same issue as both neighbors", async () => {
      const moved = await addIssue();
      const neighbor = await addIssue({ status: "done" });
      const error = await moveError({
        issueKey: moved.key,
        status: "done",
        previousIssueKey: neighbor.key,
        nextIssueKey: neighbor.key,
      });
      expect(error).toMatchObject({ code: "PREVIOUS_AND_NEXT_ISSUES_MUST_BE_DIFFERENT" });
    });

    test("rejects neighbors outside the user's teams and leaves the issue in place", async () => {
      const moved = await addIssue({ status: "done", sortOrder: 65536 });
      const neighbor = await addIssue({ status: "done", sortOrder: 131072 });
      const hidden = await addOtherTeamIssue({ status: "done" });

      const error = await moveError({
        issueKey: moved.key,
        status: "done",
        previousIssueKey: hidden.key,
        nextIssueKey: neighbor.key,
      });

      expect(error).toMatchObject({ code: "ISSUES_NOT_ACCESSIBLE" });
      expect(await loadIssue(moved.id)).toMatchObject({ status: "done", sortOrder: 65536 });
    });

    test("rejects neighbors that aren't in the target column", async () => {
      const moved = await addIssue();
      const elsewhere = await addIssue({ status: "in_progress" });

      const previousError = await moveError({
        issueKey: moved.key,
        status: "done",
        previousIssueKey: elsewhere.key,
      });
      const nextError = await moveError({
        issueKey: moved.key,
        status: "done",
        nextIssueKey: elsewhere.key,
      });

      expect(previousError).toMatchObject({ code: "PREVIOUS_ISSUE_NOT_IN_TARGET_COLUMN" });
      expect(nextError).toMatchObject({ code: "NEXT_ISSUE_NOT_IN_TARGET_COLUMN" });
    });

    test("needs a neighbor to move into a non-empty column", async () => {
      await addIssue({ status: "done", sortOrder: 65536 });
      const moved = await addIssue();

      const error = await moveError({ issueKey: moved.key, status: "done" });

      expect(error).toMatchObject({ code: "TARGET_COLUMN_REQUIRES_ADJACENT_ISSUE" });
      expect((await loadIssue(moved.id))?.status).toBe("to_do");
    });

    test("reports missing issues", async () => {
      const error = await moveError({ issueKey: "TES-404", status: "done" });
      expect(error).toMatchObject({ code: "ISSUE_NOT_FOUND" });
    });
  });

  describe("delete", () => {
    test("soft deletes an issue", async () => {
      const created = await create();

      const result = await runApi(authed(), (client) =>
        client.issues.delete({ params: { issueKey: created.key } }),
      );

      expect(result).toEqual({ message: "Issue deleted" });
      expect((await loadIssue(created.id))?.deletedAt).toBeInstanceOf(Date);
      expect((await listTeam()).issues).toHaveLength(0);
    });

    test("only deletes issues of the user's teams", async () => {
      const hidden = await addOtherTeamIssue();
      const error = await runApi(authed(), (client) =>
        flip(client.issues.delete({ params: { issueKey: hidden.key } })),
      );
      expect(error).toMatchObject({ code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED" });
      expect((await loadIssue(hidden.id))?.deletedAt).toBeNull();
    });

    test("bulk deletes issues", async () => {
      const first = await create();
      const second = await create();

      const result = await runApi(authed(), (client) =>
        client.issues.bulkDelete({ payload: { issueKeys: [first.key, second.key] } }),
      );

      expect(result).toEqual({ message: "2 issues deleted" });
      expect((await listTeam()).issues).toHaveLength(0);
    });

    test("bulk deletes nothing when some issues are outside the user's teams", async () => {
      const accessible = await create();
      const hidden = await addOtherTeamIssue();

      const error = await runApi(authed(), (client) =>
        flip(client.issues.bulkDelete({ payload: { issueKeys: [accessible.key, hidden.key] } })),
      );

      expect(error).toMatchObject({ code: "ISSUES_NOT_ACCESSIBLE" });
      expect((await loadIssue(accessible.id))?.deletedAt).toBeNull();
    });
  });

  describe("labels", () => {
    const addLabel = (issueKey: string, labelId: string) =>
      runApi(authed(), (client) =>
        client.issues.addLabel({ params: { issueKey }, payload: { labelId } }),
      );
    const removeLabel = (issueKey: string, labelId: string) =>
      runApi(authed(), (client) => client.issues.removeLabel({ params: { issueKey, labelId } }));
    const labelsOf = (issueId: string) =>
      testDb.db.query.labelOnIssue.findMany({ where: { issueId } });

    test("attaches and detaches a label and records both", async () => {
      const issue = await create();
      const label = createLabel("Bug");

      expect(await addLabel(issue.key, label.id)).toEqual({ success: true });
      const { issue: withLabel } = await runApi(authed(), (client) =>
        client.issues.get({ params: { issueKey: issue.key } }),
      );
      expect(withLabel.labels.map((attached) => attached.name)).toEqual(["Bug"]);

      expect(await removeLabel(issue.key, label.id)).toEqual({ success: true });
      expect(await labelsOf(issue.id)).toHaveLength(0);

      const events = await loadEvents(issue.id);
      expect(events.map((event) => [event.eventType, event.labelId])).toEqual([
        ["issue_created", null],
        ["label_added", label.id],
        ["label_removed", label.id],
      ]);
    });

    test("attaching a label twice or detaching a missing one changes nothing", async () => {
      const issue = await create();
      const label = createLabel("Bug");

      await addLabel(issue.key, label.id);
      await addLabel(issue.key, label.id);
      await removeLabel(issue.key, label.id);
      await removeLabel(issue.key, label.id);

      expect((await loadEvents(issue.id)).map((event) => event.eventType)).toEqual([
        "issue_created",
        "label_added",
        "label_removed",
      ]);
    });

    test("rejects labels of another workspace", async () => {
      const issue = await create();
      const workspace = await createWorkspace(testDb, { slug: "other" });
      const foreign = createLabel("Foreign", workspace.id);

      const addError = await runApi(authed(), (client) =>
        flip(
          client.issues.addLabel({
            params: { issueKey: issue.key },
            payload: { labelId: foreign.id },
          }),
        ),
      );
      const removeError = await runApi(authed(), (client) =>
        flip(client.issues.removeLabel({ params: { issueKey: issue.key, labelId: foreign.id } })),
      );

      expect(addError).toMatchObject({ _tag: "LabelNotFound", code: "LABEL_NOT_FOUND" });
      expect(removeError).toMatchObject({ code: "LABEL_NOT_FOUND" });
    });

    test("only labels issues of the user's teams", async () => {
      const hidden = await addOtherTeamIssue();
      const label = createLabel("Bug");

      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.addLabel({
            params: { issueKey: hidden.key },
            payload: { labelId: label.id },
          }),
        ),
      );

      expect(error).toMatchObject({ code: "TEAM_NOT_FOUND_OR_ACCESS_DENIED" });
      expect(await labelsOf(hidden.id)).toHaveLength(0);
    });

    test("caps the labels on an issue", async () => {
      const issue = await create();
      for (let i = 0; i < 100; i++) {
        const label = createLabel(`Label ${i}`);
        await testDb.db
          .insert(dbSchema.labelOnIssue)
          .values({ issueId: issue.id, labelId: label.id, workspaceId: seed.workspace.id });
      }
      const extra = createLabel("One too many");

      const error = await runApi(authed(), (client) =>
        flip(
          client.issues.addLabel({
            params: { issueKey: issue.key },
            payload: { labelId: extra.id },
          }),
        ),
      );

      expect(error).toMatchObject({
        _tag: "IssueLabelLimitReached",
        code: "ISSUE_LABEL_LIMIT_REACHED",
      });
      expect(await labelsOf(issue.id)).toHaveLength(100);
    });
  });
});
