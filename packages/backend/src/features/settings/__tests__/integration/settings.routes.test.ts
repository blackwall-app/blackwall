import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Settings Routes", () => {
  const getCtx = useTestContext();

  describe("GET /settings/profile", () => {
    it("should return the current user profile", async () => {
      const { client, headers, user } = getCtx();
      const res = await client.api.settings.profile.$get({}, { headers: headers() });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { profile: { id: string; email: string } };
      expect(json.profile).toBeDefined();
      expect(json.profile.id).toBe(user.id);
      expect(json.profile.email).toBe(user.email);
    });
  });

  describe("PATCH /settings/profile", () => {
    it("should update the user name", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.settings.profile.$patch(
        { json: { name: "Updated Name" } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.profile.name).toBe("Updated Name");
    });

    it("should return 400 when name is too short", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.settings.profile.$patch(
        { json: { name: "A" } },
        { headers: headers() },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /settings/workspace", () => {
    it("should return the current workspace", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.settings.workspace.$get({}, { headers: headers() });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspace).toBeDefined();
      expect(json.workspace.id).toBe(workspace.id);
    });
  });

  describe("PATCH /settings/workspace", () => {
    it("should update workspace display name", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.settings.workspace.$patch(
        { json: { displayName: "Updated Workspace" } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspace.displayName).toBe("Updated Workspace");
    });

    it("should return 400 when displayName is too short", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.settings.workspace.$patch(
        { json: { displayName: "A" } },
        { headers: headers() },
      );

      expect(res.status).toBe(400);
    });
  });
});
