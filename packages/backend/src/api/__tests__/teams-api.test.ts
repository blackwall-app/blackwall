import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleEffectRequest } from "../index";
import { env } from "../../lib/zod-env";
import { runApi } from "../../test/api";
import {
  addUserToTeam,
  addUserToWorkspace,
  createIssueSprint,
  createTeam,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("teams api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  // The typed client validates payloads before sending and decodes responses,
  // so wire-level checks go through the raw handler.
  const rawRequest = (path: string, init: { method?: string; body?: unknown } = {}) =>
    handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect${path}`, {
        method: init.method ?? "GET",
        headers: {
          "content-type": "application/json",
          cookie: seed.cookie,
          [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
    );

  const setLastTeam = (teamId: string | null) =>
    testDb.db
      .update(dbSchema.user)
      .set({ lastTeamId: teamId })
      .where(eq(dbSchema.user.id, seed.user.id));

  describe("access", () => {
    test("rejects requests without a session", async () => {
      const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
        Effect.flip(client.teams.list()),
      );
      expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
    });

    test("requires the workspace header", async () => {
      const error = await runApi({ cookie: seed.cookie }, (client) =>
        Effect.flip(client.teams.list()),
      );
      expect(error).toMatchObject({
        _tag: "MissingWorkspaceHeader",
        code: "MISSING_WORKSPACE_HEADER",
      });
    });

    test("rejects workspaces the user doesn't belong to", async () => {
      await createWorkspace(testDb, { slug: "private", displayName: "Private" });

      const error = await runApi({ cookie: seed.cookie, workspaceSlug: "private" }, (client) =>
        Effect.flip(client.teams.list()),
      );

      expect(error).toMatchObject({ _tag: "NotWorkspaceMember", code: "NOT_WORKSPACE_MEMBER" });
    });
  });

  describe("GET /teams", () => {
    test("returns the seeded team with no active sprint", async () => {
      const { teams } = await runApi(authed(), (client) => client.teams.list());

      expect(teams.map((team) => team.key)).toEqual([seed.team.key]);
      expect(teams[0]?.activeSprint).toBeNull();
      expect(teams[0]?.createdAt).toBeInstanceOf(Date);
    });

    test("leaves out teams the user isn't a member of", async () => {
      await createTeam(testDb, {
        key: "UA1",
        name: "Unassigned 1",
        workspaceId: seed.workspace.id,
      });
      await createTeam(testDb, {
        key: "UA2",
        name: "Unassigned 2",
        workspaceId: seed.workspace.id,
      });

      const { teams } = await runApi(authed(), (client) => client.teams.list());

      expect(teams.map((team) => team.key)).toEqual([seed.team.key]);
    });

    test("includes a team once the user joins it", async () => {
      const extra = await createTeam(testDb, {
        key: "EXT",
        name: "Extra",
        workspaceId: seed.workspace.id,
      });
      await addUserToTeam(testDb, { teamId: extra.id, userId: seed.user.id });

      const { teams } = await runApi(authed(), (client) => client.teams.list());

      expect(teams.map((team) => team.key).sort()).toEqual(["EXT", seed.team.key].sort());
    });

    test("only lists teams from the requested workspace", async () => {
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      await addUserToWorkspace(testDb, { userId: seed.user.id, workspaceId: other.id });
      const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
      await addUserToTeam(testDb, { teamId: otherTeam.id, userId: seed.user.id });

      const { teams } = await runApi(authed(), (client) => client.teams.list());
      const { teams: otherTeams } = await runApi(
        { cookie: seed.cookie, workspaceSlug: "other" },
        (client) => client.teams.list(),
      );

      expect(teams.map((team) => team.key)).toEqual([seed.team.key]);
      expect(otherTeams.map((team) => team.key)).toEqual(["OTH"]);
    });

    test("includes the active sprint", async () => {
      const sprint = await createIssueSprint(testDb, {
        name: "Sprint 1",
        status: "active",
        teamId: seed.team.id,
        createdById: seed.user.id,
      });

      const { teams } = await runApi(authed(), (client) => client.teams.list());

      expect(teams[0]?.activeSprint?.id).toBe(sprint.id);
      expect(teams[0]?.activeSprint?.startDate).toBeInstanceOf(Date);
    });

    test("sends teams with ISO timestamps and a null active sprint", async () => {
      const response = await rawRequest("/teams");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        teams: [
          {
            id: seed.team.id,
            name: seed.team.name,
            workspaceId: seed.workspace.id,
            key: seed.team.key,
            avatar: null,
            createdAt: seed.team.createdAt.toISOString(),
            updatedAt: seed.team.updatedAt.toISOString(),
            deletedAt: null,
            activeSprint: null,
          },
        ],
      });
    });
  });

  describe("POST /teams", () => {
    test("creates a team without adding the creator to it", async () => {
      const { team } = await runApi(authed(), (client) =>
        client.teams.create({
          payload: { name: "New Team", key: "NEW", workspaceId: seed.workspace.id },
        }),
      );

      expect(team).toMatchObject({ name: "New Team", key: "NEW", workspaceId: seed.workspace.id });
      const membership = await testDb.db.query.userTeam.findFirst({
        where: { teamId: team.id, userId: seed.user.id },
      });
      expect(membership).toBeUndefined();
    });

    test("rejects a key another team in the workspace uses", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.teams.create({
            payload: { name: "Duplicate", key: seed.team.key, workspaceId: seed.workspace.id },
          }),
        ),
      );

      expect(error).toMatchObject({
        _tag: "TeamKeyAlreadyExists",
        code: "TEAM_KEY_ALREADY_EXISTS",
      });
      const teams = await testDb.db.query.team.findMany({
        where: { workspaceId: seed.workspace.id },
      });
      expect(teams).toHaveLength(1);
    });

    test("allows a key a team in another workspace uses", async () => {
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      await createTeam(testDb, { key: "SHR", workspaceId: other.id });

      const { team } = await runApi(authed(), (client) =>
        client.teams.create({
          payload: { name: "Shared Key", key: "SHR", workspaceId: seed.workspace.id },
        }),
      );

      expect(team.key).toBe("SHR");
    });

    test("claims a key that was an alias of a renamed team", async () => {
      await testDb.db.insert(dbSchema.teamKeyAlias).values({
        workspaceId: seed.workspace.id,
        key: "OLD",
        teamId: seed.team.id,
      });

      await runApi(authed(), (client) =>
        client.teams.create({
          payload: { name: "Old Key", key: "OLD", workspaceId: seed.workspace.id },
        }),
      );

      const aliases = await testDb.db.query.teamKeyAlias.findMany({
        where: { workspaceId: seed.workspace.id },
      });
      expect(aliases).toEqual([]);
    });

    test("rejects a workspaceId other than the header's workspace", async () => {
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });

      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.teams.create({
            payload: { name: "Sneaky", key: "SNK", workspaceId: other.id },
          }),
        ),
      );

      expect(error).toMatchObject({ _tag: "ValidationError", code: "VALIDATION_ERROR" });
      const teams = await testDb.db.query.team.findMany({ where: { workspaceId: other.id } });
      expect(teams).toEqual([]);
    });

    test.each([
      ["a name under 2 characters", { name: "A", key: "NEW" }],
      ["a name over 30 characters", { name: "A".repeat(31), key: "NEW" }],
      ["a key under 3 characters", { name: "New Team", key: "AB" }],
      ["a key over 5 characters", { name: "New Team", key: "ABCDEF" }],
    ])("rejects %s", async (_, fields) => {
      const response = await rawRequest("/teams", {
        method: "POST",
        body: { ...fields, workspaceId: seed.workspace.id },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        _tag: "ValidationError",
        code: "VALIDATION_ERROR",
      });
    });

    test("rejects a missing or malformed workspaceId", async () => {
      const missing = await rawRequest("/teams", {
        method: "POST",
        body: { name: "New Team", key: "NEW" },
      });
      const malformed = await rawRequest("/teams", {
        method: "POST",
        body: { name: "New Team", key: "NEW", workspaceId: "not-a-uuid" },
      });

      expect(missing.status).toBe(400);
      expect(malformed.status).toBe(400);
    });
  });

  describe("GET /teams/preferred", () => {
    test("returns the last visited team", async () => {
      const second = await createTeam(testDb, {
        key: "SEC",
        name: "Second",
        workspaceId: seed.workspace.id,
      });
      await addUserToTeam(testDb, { teamId: second.id, userId: seed.user.id });
      await setLastTeam(second.id);

      const { team } = await runApi(authed(), (client) => client.teams.preferred());

      expect(team?.id).toBe(second.id);
    });

    test("falls back to the first team without a last visited team", async () => {
      const { team } = await runApi(authed(), (client) => client.teams.preferred());

      expect(team?.id).toBe(seed.team.id);
    });

    test("ignores a last visited team the user no longer belongs to", async () => {
      const left = await createTeam(testDb, { key: "LFT", workspaceId: seed.workspace.id });
      await setLastTeam(left.id);

      const { team } = await runApi(authed(), (client) => client.teams.preferred());

      expect(team?.id).toBe(seed.team.id);
    });

    test("ignores a last visited team from another workspace", async () => {
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
      await addUserToTeam(testDb, { teamId: otherTeam.id, userId: seed.user.id });
      await setLastTeam(otherTeam.id);

      const { team } = await runApi(authed(), (client) => client.teams.preferred());

      expect(team?.id).toBe(seed.team.id);
    });

    test("returns null when the user has no teams in the workspace", async () => {
      await testDb.db.delete(dbSchema.userTeam).where(eq(dbSchema.userTeam.userId, seed.user.id));

      const { team } = await runApi(authed(), (client) => client.teams.preferred());

      expect(team).toBeNull();
    });
  });

  describe("GET /teams/with-active-sprints", () => {
    test("lists only the user's teams that are running a sprint", async () => {
      const idle = await createTeam(testDb, { key: "IDL", workspaceId: seed.workspace.id });
      await addUserToTeam(testDb, { teamId: idle.id, userId: seed.user.id });
      const foreign = await createTeam(testDb, { key: "FOR", workspaceId: seed.workspace.id });
      await createIssueSprint(testDb, {
        status: "active",
        teamId: foreign.id,
        createdById: seed.user.id,
      });
      const sprint = await createIssueSprint(testDb, {
        status: "active",
        teamId: seed.team.id,
        createdById: seed.user.id,
      });

      const { teams } = await runApi(authed(), (client) => client.teams.listWithActiveSprints());

      expect(teams.map((team) => team.key)).toEqual([seed.team.key]);
      expect(teams[0]?.activeSprint?.id).toBe(sprint.id);
    });

    test("returns an empty list when no team has an active sprint", async () => {
      await createIssueSprint(testDb, {
        status: "planned",
        teamId: seed.team.id,
        createdById: seed.user.id,
      });

      const { teams } = await runApi(authed(), (client) => client.teams.listWithActiveSprints());

      expect(teams).toEqual([]);
    });
  });

  describe("GET /teams/:teamKey", () => {
    test("returns a team the user belongs to", async () => {
      const { team } = await runApi(authed(), (client) =>
        client.teams.getByKey({ params: { teamKey: seed.team.key } }),
      );

      expect(team).toMatchObject({ id: seed.team.id, key: seed.team.key, activeSprint: null });
    });

    test("reports unknown keys, other members' teams, and other workspaces' teams alike", async () => {
      await createTeam(testDb, { key: "PRV", workspaceId: seed.workspace.id });
      const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
      await addUserToWorkspace(testDb, { userId: seed.user.id, workspaceId: other.id });
      const otherTeam = await createTeam(testDb, { key: "OTH", workspaceId: other.id });
      await addUserToTeam(testDb, { teamId: otherTeam.id, userId: seed.user.id });

      const errors = await Promise.all(
        ["NOPE", "PRV", "OTH"].map((teamKey) =>
          runApi(authed(), (client) => Effect.flip(client.teams.getByKey({ params: { teamKey } }))),
        ),
      );

      for (const error of errors) {
        expect(error).toMatchObject({
          _tag: "TeamNotFoundOrNotMember",
          code: "TEAM_NOT_FOUND_OR_NOT_MEMBER",
        });
      }
    });
  });

  describe("GET /teams/:teamKey/users", () => {
    test("lists the team's members", async () => {
      const teammate = await createUser(testDb, { email: "mate@example.com", name: "Mate" });
      await addUserToWorkspace(testDb, { userId: teammate.id, workspaceId: seed.workspace.id });
      await addUserToTeam(testDb, { teamId: seed.team.id, userId: teammate.id });
      await createUser(testDb, { email: "outsider@example.com" });

      const { users } = await runApi(authed(), (client) =>
        client.teams.listUsers({ params: { teamKey: seed.team.key } }),
      );

      expect(users.map((user) => user.email).sort()).toEqual(
        ["mate@example.com", seed.user.email].sort(),
      );
    });

    test("leaves private user fields out of the response", async () => {
      await setLastTeam(seed.team.id);

      const response = await rawRequest(`/teams/${seed.team.key}/users`);

      expect(response.status).toBe(200);
      const { users } = (await response.json()) as { users: Array<Record<string, unknown>> };
      expect(Object.keys(users[0] ?? {}).sort()).toEqual(
        ["createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt"].sort(),
      );
    });

    test("forbids listing members of a team the user isn't on", async () => {
      await createTeam(testDb, { key: "PRV", workspaceId: seed.workspace.id });

      const error = await runApi(authed(), (client) =>
        Effect.flip(client.teams.listUsers({ params: { teamKey: "PRV" } })),
      );

      expect(error).toMatchObject({
        _tag: "NotMemberOfThisTeam",
        code: "NOT_MEMBER_OF_THIS_TEAM",
      });
    });

    test("returns 403 for an unknown team", async () => {
      const response = await rawRequest("/teams/NOPE/users");

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "NOT_MEMBER_OF_THIS_TEAM" });
    });
  });
});
