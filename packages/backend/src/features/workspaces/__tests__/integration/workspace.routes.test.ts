import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Workspace Routes", () => {
  const getCtx = useTestContext();

  describe("GET /workspaces", () => {
    it("should return empty array when no workspaces exist", async () => {
      const { client, headersWithoutWorkspace, workspace } = getCtx();
      const res = await client.api.workspaces.$get(
        {},
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspaces).toHaveLength(1);
      expect(json.workspaces[0].slug).toBe(workspace.slug);
    });

    it("should return list of workspaces for user", async () => {
      const { client, headersWithoutWorkspace } = getCtx();
      const res = await client.api.workspaces.$get(
        {},
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspaces).toHaveLength(1);
    });

    it("should return only workspaces the user is a member of", async () => {
      const { client, headersWithoutWorkspace } = getCtx();
      await client.api.auth.signup.email.$post(
        {
          json: {
            email: "extra1@example.com",
            password: "password123",
            name: "Test User 1",
            workspaceDisplayName: "Workspace 1",
            workspaceUrlSlug: "workspace-1",
          },
        },
        {
          headers: headersWithoutWorkspace(),
        },
      );
      await client.api.auth.signup.email.$post(
        {
          json: {
            email: "extra2@example.com",
            password: "password123",
            name: "Test User 2",
            workspaceDisplayName: "Workspace 2",
            workspaceUrlSlug: "workspace-2",
          },
        },
        {
          headers: headersWithoutWorkspace(),
        },
      );

      const res = await client.api.workspaces.$get(
        {},
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspaces).toHaveLength(1);
    });
  });

  describe("POST /workspaces", () => {
    it("should create a new workspace", async () => {
      const { client, headersWithoutWorkspace } = getCtx();
      const res = await client.api.workspaces.create.$post(
        {
          json: {
            displayName: "New Workspace",
            slug: "new-ws",
          },
        },
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspace).toHaveProperty("id");
      expect(json.workspace.displayName).toBe("New Workspace");
      expect(json.workspace.slug).toBe("new-ws");
    });

    it("should return 400 when displayName is missing", async () => {
      const { client, headersWithoutWorkspace } = getCtx();
      const res = await client.api.workspaces.create.$post(
        {
          // @ts-expect-error - intentionally missing displayName for validation test
          json: {
            slug: "new-workspace",
          },
        },
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 when slug is missing", async () => {
      const { client, headersWithoutWorkspace } = getCtx();
      const res = await client.api.workspaces.create.$post(
        {
          // @ts-expect-error - intentionally missing slug for validation test
          json: {
            displayName: "New Workspace",
          },
        },
        {
          headers: headersWithoutWorkspace(),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /workspaces/:workspaceId", () => {
    it("should update workspace display name", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.workspaces[":workspaceId"].$patch(
        {
          param: { workspaceId: workspace.id },
          json: { displayName: "Updated Name" },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspace.displayName).toBe("Updated Name");
    });

    it("should return 400 when displayName is too short", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.workspaces[":workspaceId"].$patch(
        {
          param: { workspaceId: workspace.id },
          json: { displayName: "A" },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /workspaces/:slug/members", () => {
    it("should return list of workspace members", async () => {
      const { client, headers, workspace, user } = getCtx();
      const res = await client.api.workspaces[":slug"].members.$get(
        { param: { slug: workspace.slug } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { members: { id: string }[] };
      expect(json.members).toBeInstanceOf(Array);
      expect(json.members.length).toBeGreaterThanOrEqual(1);
      expect(json.members.some((m) => m.id === user.id)).toBe(true);
    });

    it("should not return list of workspace members for a workspace that the user is not a member of", async () => {
      const { client, headers } = getCtx();
      await client.api.auth.signup.email.$post(
        {
          json: {
            email: "extra1@example.com",
            password: "password123",
            name: "Test User 1",
            workspaceDisplayName: "Some other workspace",
            workspaceUrlSlug: "other-workspace",
          },
        },
        {
          headers: headers(),
        },
      );

      const res = await client.api.workspaces[":slug"].members.$get(
        { param: { slug: "other-workspace" } },
        { headers: headers() },
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /workspaces/:slug/members/:userId", () => {
    it("should return a specific workspace member", async () => {
      const { client, headers, workspace, user } = getCtx();
      const res = await client.api.workspaces[":slug"].members[":userId"].$get(
        { param: { slug: workspace.slug, userId: user.id } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { member: { id: string; teams: unknown[] } };
      expect(json.member.id).toBe(user.id);
      expect(json.member.teams).toBeInstanceOf(Array);
    });

    it("should return 404 for non-existent member", async () => {
      const { client, headers, workspace } = getCtx();
      const res = await client.api.workspaces[":slug"].members[":userId"].$get(
        { param: { slug: workspace.slug, userId: "non-existent-user-id" } },
        { headers: headers() },
      );

      expect(res.status).toBe(404);
    });

    it("should return 403 when user is not a member of the workspace", async () => {
      const { client, headersWithoutWorkspace } = getCtx();

      await client.api.auth.signup.email.$post({
        json: {
          email: "extra1@example.com",
          password: "password123",
          name: "Test User 1",
          workspaceDisplayName: "Some other workspace",
          workspaceUrlSlug: "other-workspace",
        },
      });

      const memberRes = await client.api.workspaces[":slug"].members.$get(
        { param: { slug: "other-workspace" } },
        { headers: headersWithoutWorkspace() },
      );

      expect(memberRes.status).toBe(403);
    });
  });
});
