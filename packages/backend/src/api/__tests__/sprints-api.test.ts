import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { WORKSPACE_SLUG_HEADER, type CompleteSprint, type SprintDetails } from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleEffectRequest } from "../index";
import { SprintService } from "../../features/issue-sprints/SprintService";
import { AppLayer } from "../../lib/effect/runtime";
import { env } from "../../lib/zod-env";
import { runApi } from "../../test/api";
import { createIssue, createIssueSprint, createTeam, seedTestSetup } from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("sprints api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });
  const teamKey = () => seed.team.key;

  const form = (overrides: Partial<SprintDetails> = {}): SprintDetails => ({
    name: "Sprint 1",
    goal: "Ship it",
    startDate: "2026-03-10",
    endDate: "2026-03-24",
    ...overrides,
  });

  const createSprint = async (overrides: Partial<SprintDetails> = {}) => {
    const { sprint } = await runApi(authed(), (client) =>
      client.sprints.create({ params: { teamKey: teamKey() }, payload: form(overrides) }),
    );
    return sprint;
  };

  const startSprint = (sprintId: string) =>
    runApi(authed(), (client) =>
      client.sprints.start({ params: { teamKey: teamKey(), sprintId } }),
    );

  const completeSprint = (sprintId: string, payload: CompleteSprint) =>
    runApi(authed(), (client) =>
      client.sprints.complete({
        params: { teamKey: teamKey(), sprintId },
        payload: payload as never,
      }),
    );

  const flip = <A, E>(effect: Effect.Effect<A, E>) => Effect.flip(effect);

  const addIssue = (sprintId: string, status: "to_do" | "in_progress" | "done") =>
    createIssue(testDb, {
      workspaceId: seed.workspace.id,
      teamId: seed.team.id,
      createdById: seed.user.id,
      sprintId,
      status,
    });

  const loadIssue = async (id: string) => {
    const [row] = await testDb.db.select().from(dbSchema.issue).where(eq(dbSchema.issue.id, id));
    return row;
  };

  const loadSprint = async (id: string) => {
    const [row] = await testDb.db
      .select()
      .from(dbSchema.issueSprint)
      .where(eq(dbSchema.issueSprint.id, id));
    return row;
  };

  const sendRaw = (method: string, path: string, body: unknown) =>
    handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect/teams/${teamKey()}/sprints${path}`, {
        method,
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
      flip(client.sprints.list({ params: { teamKey: teamKey() } })),
    );
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("hides teams the user doesn't belong to", async () => {
    const other = await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
    const sprint = await createIssueSprint(testDb, {
      teamId: other.id,
      createdById: seed.user.id,
    });

    const listError = await runApi(authed(), (client) =>
      flip(client.sprints.list({ params: { teamKey: other.key } })),
    );
    const getError = await runApi(authed(), (client) =>
      flip(client.sprints.get({ params: { teamKey: other.key, sprintId: sprint.id }, query: {} })),
    );

    expect(listError).toMatchObject({ _tag: "TeamNotFound", code: "TEAM_NOT_FOUND" });
    expect(getError).toMatchObject({ _tag: "TeamNotFound", code: "TEAM_NOT_FOUND" });
  });

  test("doesn't find another team's sprint through this team", async () => {
    const other = await createTeam(testDb, { workspaceId: seed.workspace.id, key: "OTH" });
    const sprint = await createIssueSprint(testDb, {
      teamId: other.id,
      createdById: seed.user.id,
    });

    const error = await runApi(authed(), (client) =>
      flip(client.sprints.get({ params: { teamKey: teamKey(), sprintId: sprint.id }, query: {} })),
    );
    expect(error).toMatchObject({ _tag: "IssueSprintNotFound", code: "ISSUE_SPRINT_NOT_FOUND" });
  });

  describe("create", () => {
    test("creates a planned sprint spanning whole UTC days", async () => {
      const sprint = await createSprint({ name: "Sprint 1", goal: "Ship it" });

      expect(sprint).toMatchObject({ name: "Sprint 1", goal: "Ship it", status: "planned" });
      expect(sprint.startDate.toISOString()).toBe("2026-03-10T00:00:00.000Z");
      expect(sprint.endDate.toISOString()).toBe("2026-03-24T23:59:59.999Z");

      const { sprint: active } = await runApi(authed(), (client) =>
        client.sprints.active({ params: { teamKey: teamKey() } }),
      );
      expect(active).toBeNull();
    });

    test("responds with 201", async () => {
      const response = await sendRaw("POST", "", form());
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        sprint: { name: "Sprint 1", startDate: "2026-03-10T00:00:00.000Z" },
      });
    });

    test("accepts a sprint that starts and ends on the same day", async () => {
      const sprint = await createSprint({ startDate: "2026-03-10", endDate: "2026-03-10" });
      expect(sprint.endDate.toISOString()).toBe("2026-03-10T23:59:59.999Z");
    });

    test("rejects invalid payloads", async () => {
      for (const body of [
        form({ startDate: "2026-03-11", endDate: "2026-03-10" }),
        form({ name: "" }),
        form({ startDate: "2026-02-30" }),
        form({ endDate: "10.03.2026" }),
      ]) {
        const response = await sendRaw("POST", "", body);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
      }
    });
  });

  describe("list", () => {
    test("lists the team's sprints newest first without archived ones", async () => {
      await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        name: "Old",
        createdAt: new Date("2026-01-01"),
      });
      await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        name: "New",
        createdAt: new Date("2026-02-01"),
      });
      await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        name: "Archived",
        archivedAt: new Date(),
      });

      const { sprints } = await runApi(authed(), (client) =>
        client.sprints.list({ params: { teamKey: teamKey() } }),
      );

      expect(sprints.map((sprint) => sprint.name)).toEqual(["New", "Old"]);
      expect(sprints[0]?.startDate).toBeInstanceOf(Date);
    });
  });

  describe("get", () => {
    test("returns the sprint with its issues, paginated", async () => {
      const sprint = await createSprint();
      const first = await addIssue(sprint.id, "to_do");
      const second = await addIssue(sprint.id, "done");
      await createIssue(testDb, {
        workspaceId: seed.workspace.id,
        teamId: seed.team.id,
        createdById: seed.user.id,
      });

      const page = await runApi(authed(), (client) =>
        client.sprints.get({
          params: { teamKey: teamKey(), sprintId: sprint.id },
          query: { limit: 1 },
        }),
      );
      expect(page.sprint.id).toBe(sprint.id);
      expect(page.issues.map((issue) => issue.id)).toEqual([first.id]);
      expect(page.issues[0]).toMatchObject({ labels: [], assignedTo: null });
      expect(page.issues[0]?.issueSprint?.id).toBe(sprint.id);
      expect(page.issues[0]).not.toHaveProperty("description");
      expect(page.nextCursor).toBe(first.id);

      const next = await runApi(authed(), (client) =>
        client.sprints.get({
          params: { teamKey: teamKey(), sprintId: sprint.id },
          query: { cursor: page.nextCursor!, limit: 1 },
        }),
      );
      expect(next.issues.map((issue) => issue.id)).toEqual([second.id]);
      expect(next.nextCursor).toBeNull();
    });

    test("fails for an unknown sprint", async () => {
      const error = await runApi(authed(), (client) =>
        flip(client.sprints.get({ params: { teamKey: teamKey(), sprintId: "nope" }, query: {} })),
      );
      expect(error).toMatchObject({ _tag: "IssueSprintNotFound", code: "ISSUE_SPRINT_NOT_FOUND" });
    });
  });

  describe("start", () => {
    test("starts a planned sprint and makes it the team's active sprint", async () => {
      const created = await createSprint();
      const { sprint } = await startSprint(created.id);

      expect(sprint).toMatchObject({ id: created.id, status: "active" });

      const { sprint: active } = await runApi(authed(), (client) =>
        client.sprints.active({ params: { teamKey: teamKey() } }),
      );
      expect(active?.id).toBe(created.id);
    });

    test("rejects starting a second sprint while one is active", async () => {
      const first = await createSprint({ name: "Sprint 1" });
      const second = await createSprint({ name: "Sprint 2" });
      await startSprint(first.id);

      const error = await runApi(authed(), (client) =>
        flip(client.sprints.start({ params: { teamKey: teamKey(), sprintId: second.id } })),
      );
      expect(error).toMatchObject({
        _tag: "CannotStartWhileSprintActive",
        code: "CANNOT_START_WHILE_SPRINT_ACTIVE",
      });
      expect((await loadSprint(second.id))?.status).toBe("planned");
    });

    test("rejects a second active sprint even when the caller didn't see the first one", async () => {
      await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        status: "active",
      });
      const planned = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
      });

      const error = await Effect.runPromise(
        Effect.gen(function* () {
          const sprints = yield* SprintService;
          return yield* Effect.flip(
            sprints.startSprint({
              team: { id: seed.team.id, activeSprint: null },
              sprintId: planned.id,
            }),
          );
        }).pipe(Effect.provide(AppLayer)),
      );

      expect(error).toMatchObject({ code: "CANNOT_START_WHILE_SPRINT_ACTIVE" });
      expect((await loadSprint(planned.id))?.status).toBe("planned");
    });

    test("rejects starting an already active sprint", async () => {
      const created = await createSprint();
      await startSprint(created.id);

      const error = await runApi(authed(), (client) =>
        flip(client.sprints.start({ params: { teamKey: teamKey(), sprintId: created.id } })),
      );
      expect(error).toMatchObject({ _tag: "SprintAlreadyActive", code: "SPRINT_ALREADY_ACTIVE" });
    });

    test("rejects starting an archived sprint", async () => {
      const sprint = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        archivedAt: new Date(),
      });

      const error = await runApi(authed(), (client) =>
        flip(client.sprints.start({ params: { teamKey: teamKey(), sprintId: sprint.id } })),
      );
      expect(error).toMatchObject({
        _tag: "CannotStartArchivedSprint",
        code: "CANNOT_START_ARCHIVED_SPRINT",
      });
    });
  });

  describe("update", () => {
    test("updates a planned sprint", async () => {
      const created = await createSprint();

      const { sprint } = await runApi(authed(), (client) =>
        client.sprints.update({
          params: { teamKey: teamKey(), sprintId: created.id },
          payload: form({ name: "Renamed", goal: null, endDate: "2026-03-31" }),
        }),
      );

      expect(sprint).toMatchObject({ id: created.id, name: "Renamed", goal: null });
      expect(sprint.endDate.toISOString()).toBe("2026-03-31T23:59:59.999Z");
    });

    test("rejects updating an archived sprint", async () => {
      const sprint = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        archivedAt: new Date(),
      });

      const error = await runApi(authed(), (client) =>
        flip(
          client.sprints.update({
            params: { teamKey: teamKey(), sprintId: sprint.id },
            payload: form(),
          }),
        ),
      );
      expect(error).toMatchObject({
        _tag: "CannotUpdateArchivedSprint",
        code: "CANNOT_UPDATE_ARCHIVED_SPRINT",
      });
    });

    test("rejects an end date before the start date", async () => {
      const created = await createSprint();
      const response = await sendRaw(
        "PATCH",
        `/${created.id}`,
        form({ startDate: "2026-03-11", endDate: "2026-03-10" }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("complete context", () => {
    test("lists the other planned sprints and reports undone issues", async () => {
      const active = await createSprint({ name: "Active" });
      const planned = await createSprint({ name: "Planned" });
      await startSprint(active.id);
      await addIssue(active.id, "in_progress");
      await addIssue(active.id, "done");

      const context = await runApi(authed(), (client) =>
        client.sprints.completeContext({ params: { teamKey: teamKey(), sprintId: active.id } }),
      );

      expect(context.sprint.id).toBe(active.id);
      expect(context.hasUndoneIssues).toBe(true);
      expect(context.plannedSprints.map((sprint) => sprint.id)).toEqual([planned.id]);
    });

    test("reports no undone issues when everything is done", async () => {
      const active = await createSprint();
      await startSprint(active.id);
      await addIssue(active.id, "done");

      const context = await runApi(authed(), (client) =>
        client.sprints.completeContext({ params: { teamKey: teamKey(), sprintId: active.id } }),
      );
      expect(context.hasUndoneIssues).toBe(false);
    });

    test("fails for an unknown sprint", async () => {
      const error = await runApi(authed(), (client) =>
        flip(client.sprints.completeContext({ params: { teamKey: teamKey(), sprintId: "nope" } })),
      );
      expect(error).toMatchObject({ code: "ISSUE_SPRINT_NOT_FOUND" });
    });
  });

  describe("complete", () => {
    test("moves undone issues to the backlog and keeps done ones", async () => {
      const sprint = await createSprint({ endDate: "2099-01-01" });
      await startSprint(sprint.id);
      const todo = await addIssue(sprint.id, "to_do");
      const done = await addIssue(sprint.id, "done");

      const { success } = await completeSprint(sprint.id, { onUndoneIssues: "moveToBacklog" });

      expect(success).toBe(true);
      expect((await loadIssue(todo.id))?.sprintId).toBeNull();
      expect((await loadIssue(done.id))?.sprintId).toBe(sprint.id);
      const completed = await loadSprint(sprint.id);
      expect(completed?.status).toBe("completed");
      expect(completed?.finishedAt).not.toBeNull();

      const { sprint: active } = await runApi(authed(), (client) =>
        client.sprints.active({ params: { teamKey: teamKey() } }),
      );
      expect(active).toBeNull();
    });

    test("moves undone issues to a planned sprint", async () => {
      const sprint = await createSprint({ name: "Active" });
      const planned = await createSprint({ name: "Planned" });
      await startSprint(sprint.id);
      const todo = await addIssue(sprint.id, "to_do");

      await completeSprint(sprint.id, {
        onUndoneIssues: "moveToPlannedSprint",
        targetSprintId: planned.id,
      });

      expect((await loadIssue(todo.id))?.sprintId).toBe(planned.id);
    });

    test("moves undone issues to a new planned sprint", async () => {
      const sprint = await createSprint();
      await startSprint(sprint.id);
      const todo = await addIssue(sprint.id, "in_progress");

      await completeSprint(sprint.id, {
        onUndoneIssues: "moveToNewSprint",
        newSprint: { name: "Next Sprint", startDate: "2026-03-10", endDate: "2026-03-14" },
      });

      const next = await testDb.db.query.issueSprint.findFirst({
        where: { teamId: seed.team.id, name: "Next Sprint" },
      });
      expect(next?.status).toBe("planned");
      expect(next?.createdById).toBe(seed.user.id);
      expect(next?.startDate.toISOString()).toBe("2026-03-10T00:00:00.000Z");
      expect(next?.endDate.toISOString()).toBe("2026-03-14T23:59:59.999Z");
      expect((await loadIssue(todo.id))?.sprintId).toBe(next!.id);
    });

    test("rejects completing a sprint that isn't active", async () => {
      const sprint = await createSprint();

      const error = await runApi(authed(), (client) =>
        flip(
          client.sprints.complete({
            params: { teamKey: teamKey(), sprintId: sprint.id },
            payload: { onUndoneIssues: "moveToBacklog" },
          }),
        ),
      );
      expect(error).toMatchObject({
        _tag: "OnlyActiveSprintsCanBeCompleted",
        code: "ONLY_ACTIVE_SPRINTS_CAN_BE_COMPLETED",
      });
    });

    test("rejects a target sprint that doesn't exist or isn't planned", async () => {
      const sprint = await createSprint({ name: "Active" });
      await startSprint(sprint.id);
      const completed = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        status: "completed",
      });
      const todo = await addIssue(sprint.id, "to_do");

      const missing = await runApi(authed(), (client) =>
        flip(
          client.sprints.complete({
            params: { teamKey: teamKey(), sprintId: sprint.id },
            payload: { onUndoneIssues: "moveToPlannedSprint", targetSprintId: "nope" },
          }),
        ),
      );
      const notPlanned = await runApi(authed(), (client) =>
        flip(
          client.sprints.complete({
            params: { teamKey: teamKey(), sprintId: sprint.id },
            payload: { onUndoneIssues: "moveToPlannedSprint", targetSprintId: completed.id },
          }),
        ),
      );

      expect(missing).toMatchObject({ code: "TARGET_SPRINT_NOT_FOUND" });
      expect(notPlanned).toMatchObject({ code: "TARGET_SPRINT_MUST_BE_PLANNED" });
      expect((await loadSprint(sprint.id))?.status).toBe("active");
      expect((await loadIssue(todo.id))?.sprintId).toBe(sprint.id);
    });

    test("rejects an invalid new sprint", async () => {
      const sprint = await createSprint();
      await startSprint(sprint.id);

      const response = await sendRaw("POST", `/${sprint.id}/complete`, {
        onUndoneIssues: "moveToNewSprint",
        newSprint: { name: "Next", startDate: "2026-03-21", endDate: "2026-03-20" },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
      expect((await loadSprint(sprint.id))?.status).toBe("active");
    });

    test("rejects updating, starting, and completing a completed sprint", async () => {
      const sprint = await createSprint();
      await startSprint(sprint.id);
      await completeSprint(sprint.id, { onUndoneIssues: "moveToBacklog" });
      const params = { teamKey: teamKey(), sprintId: sprint.id };

      const updateError = await runApi(authed(), (client) =>
        flip(client.sprints.update({ params, payload: form() })),
      );
      const startError = await runApi(authed(), (client) => flip(client.sprints.start({ params })));
      const completeError = await runApi(authed(), (client) =>
        flip(client.sprints.complete({ params, payload: { onUndoneIssues: "moveToBacklog" } })),
      );

      expect(updateError).toMatchObject({ code: "CANNOT_UPDATE_COMPLETED_SPRINT" });
      expect(startError).toMatchObject({ code: "CANNOT_START_COMPLETED_SPRINT" });
      expect(completeError).toMatchObject({ code: "SPRINT_ALREADY_COMPLETED" });
    });

    test("rejects completing an archived sprint", async () => {
      const sprint = await createIssueSprint(testDb, {
        teamId: seed.team.id,
        createdById: seed.user.id,
        archivedAt: new Date(),
      });

      const error = await runApi(authed(), (client) =>
        flip(
          client.sprints.complete({
            params: { teamKey: teamKey(), sprintId: sprint.id },
            payload: { onUndoneIssues: "moveToBacklog" },
          }),
        ),
      );
      expect(error).toMatchObject({ code: "CANNOT_COMPLETE_ARCHIVED_SPRINT" });
    });
  });

  describe("archive", () => {
    test("archives a completed sprint and hides it from the list", async () => {
      const sprint = await createSprint();
      await startSprint(sprint.id);
      await completeSprint(sprint.id, { onUndoneIssues: "moveToBacklog" });

      const { success } = await runApi(authed(), (client) =>
        client.sprints.archive({ params: { teamKey: teamKey(), sprintId: sprint.id } }),
      );

      expect(success).toBe(true);
      expect((await loadSprint(sprint.id))?.archivedAt).not.toBeNull();
      const { sprints } = await runApi(authed(), (client) =>
        client.sprints.list({ params: { teamKey: teamKey() } }),
      );
      expect(sprints.find((item) => item.id === sprint.id)).toBeUndefined();
    });

    test("moves undone issues to the backlog and keeps done ones", async () => {
      const sprint = await createSprint();
      const todo = await addIssue(sprint.id, "to_do");
      const done = await addIssue(sprint.id, "done");

      await runApi(authed(), (client) =>
        client.sprints.archive({ params: { teamKey: teamKey(), sprintId: sprint.id } }),
      );

      expect((await loadIssue(todo.id))?.sprintId).toBeNull();
      expect((await loadIssue(done.id))?.sprintId).toBe(sprint.id);
    });

    test("rejects archiving the active sprint", async () => {
      const sprint = await createSprint();
      await startSprint(sprint.id);

      const error = await runApi(authed(), (client) =>
        flip(client.sprints.archive({ params: { teamKey: teamKey(), sprintId: sprint.id } })),
      );
      expect(error).toMatchObject({
        _tag: "CannotArchiveActiveSprint",
        code: "CANNOT_ARCHIVE_ACTIVE_SPRINT",
      });
    });

    test("rejects archiving twice", async () => {
      const sprint = await createSprint();
      const params = { teamKey: teamKey(), sprintId: sprint.id };
      await runApi(authed(), (client) => client.sprints.archive({ params }));

      const error = await runApi(authed(), (client) => flip(client.sprints.archive({ params })));
      expect(error).toMatchObject({ code: "SPRINT_ALREADY_ARCHIVED" });
    });
  });
});
