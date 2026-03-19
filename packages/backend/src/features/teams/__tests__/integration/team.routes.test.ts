import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { useTestContext } from "../../../../test/context";

describe("Team Routes", () => {
  const getCtx = useTestContext();

  describe("GET /teams", () => {
    it("should return seeded team for current user", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.teams.$get(
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.teams).toHaveLength(1);
    });

    it("should not include teams the user is not a member of", async () => {
      const { client, headers, workspace } = getCtx();
      await client.api.teams.create.$post(
        {
          json: {
            name: "Unassigned Team 1",
            key: "UA1",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      await client.api.teams.create.$post(
        {
          json: {
            name: "Unassigned Team 2",
            key: "UA2",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      const res = await client.api.teams.$get(
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.teams).toHaveLength(1);
    });

    it("should return teams after user is added as member", async () => {
      const { client, headers, workspace, testDb, user } = getCtx();
      const createRes = await client.api.teams.create.$post(
        {
          json: {
            name: "My Extra Team",
            key: "EXT",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(createRes.status).toBe(200);
      const created = await createRes.json();

      await testDb.db.insert(dbSchema.userTeam).values({
        teamId: created.team.id,
        userId: user.id,
      });

      const res = await client.api.teams.$get(
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.teams).toHaveLength(2);
    });
  });

  describe("POST /teams/create", () => {
    it("should create a new team", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          json: {
            name: "New Team",
            key: "NEW",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.team).toHaveProperty("id");
      expect(json.team.name).toBe("New Team");
      expect(json.team.key).toBe("NEW");
      expect(json.team.workspaceId).toBe(workspace.id);
    });

    it("should return 400 when name is too short", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          json: {
            name: "A",
            key: "NEW",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when name is too long", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          json: {
            name: "A".repeat(31),
            key: "NEW",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when key is too short", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          json: {
            name: "New Team",
            key: "AB",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when key is too long", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          json: {
            name: "New Team",
            key: "ABCDEF",
            workspaceId: workspace.id,
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when workspaceId is missing", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.teams.create.$post(
        {
          // @ts-expect-error - intentionally missing workspaceId for validation test
          json: {
            name: "New Team",
            key: "NEW",
          },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /teams/:teamKey", () => {
    it("should return team by key", async () => {
      const { client, headers, team } = getCtx();
      const res = await client.api.teams[":teamKey"].$get(
        { param: { teamKey: team.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.team).toHaveProperty("id");
      expect(json.team?.key).toBe(team.key);
    });
  });

  describe("GET /teams/:teamKey/users", () => {
    it("should return list of team users", async () => {
      const { client, headers, team } = getCtx();
      const res = await client.api.teams[":teamKey"].users.$get(
        { param: { teamKey: team.key } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.users)).toBe(true);
    });
  });

  describe("GET /teams/preferred", () => {
    it("should return preferred team for user", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.teams.preferred.$get({}, { headers: headers() });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.team === null || json.team?.id !== undefined).toBe(true);
    });
  });

  describe("GET /teams/with-active-sprints", () => {
    it("should return teams with active sprints", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.teams["with-active-sprints"].$get({}, { headers: headers() });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.teams)).toBe(true);
    });
  });
});
