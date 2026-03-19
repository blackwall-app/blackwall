import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Invitation Routes", () => {
  const getCtx = useTestContext();

  describe("POST /invitations", () => {
    it("should create an invitation", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.invitations.$post(
        {
          json: {
            email: "newuser@example.com",
          },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("message", "Invitation sent successfully.");
      expect(json).toHaveProperty("invitation");
      expect(json).toHaveProperty("invitationUrl");
      expect(json.invitation).toHaveProperty("token");
      expect(json.invitation).toHaveProperty("email", "newuser@example.com");
    });

    it("should return 400 for invalid email", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.invitations.$post(
        {
          json: {
            email: "not-an-email",
          },
        },
        { headers: headers() },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /invitations/:token", () => {
    it("should return invitation details", async () => {
      const { client, headers, workspace } = getCtx();

      const createRes = await client.api.invitations.$post(
        { json: { email: "invitee@example.com" } },
        { headers: headers() },
      );
      const createJson = await createRes.json();
      const token = createJson.invitation.token;

      const res = await client.api.invitations[":token"].$get(
        { param: { token } },
        { headers: {} },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        invitation: { email: string; workspace: { displayName: string; slug: string } };
      };
      expect(json.invitation).toHaveProperty("email", "invitee@example.com");
      expect(json.invitation.workspace).toHaveProperty("displayName", workspace.displayName);
      expect(json.invitation.workspace).toHaveProperty("slug", workspace.slug);
    });

    it("should return 404 for invalid token", async () => {
      const { client } = getCtx();
      const res = await client.api.invitations[":token"].$get(
        { param: { token: "invalid-token" } },
        { headers: {} },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /invitations/:token/accept", () => {
    it("should accept invitation for authenticated user", async () => {
      const { client, headers, headersWithoutWorkspace } = getCtx();

      const createRes = await client.api.invitations.$post(
        { json: { email: "accepter@example.com" } },
        { headers: headers() },
      );
      const createJson = await createRes.json();
      const token = createJson.invitation.token;

      const signupRes = await client.api.auth.signup.email.$post(
        {
          json: {
            email: "accepter@example.com",
            password: "password123",
            name: "Accepter User",
            workspaceDisplayName: "Other Workspace",
            workspaceUrlSlug: "other-workspace",
          },
        },
        { headers: headersWithoutWorkspace() },
      );
      const signupCookie = signupRes.headers.get("set-cookie") ?? "";

      const res = await client.api.invitations[":token"].accept.$post(
        { param: { token } },
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: signupCookie,
          },
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("message", "Invitation accepted successfully.");
      expect(json).toHaveProperty("workspaceSlug");
    });
  });

  describe("POST /invitations/:token/register", () => {
    it("should register new user and accept invitation", async () => {
      const { client, headers } = getCtx();

      const createRes = await client.api.invitations.$post(
        { json: { email: "newregistrant@example.com" } },
        { headers: headers() },
      );
      const createJson = await createRes.json();
      const token = createJson.invitation.token;

      const res = await client.api.invitations[":token"].register.$post(
        {
          param: { token },
          json: {
            name: "New Registrant",
            password: "password123",
          },
        },
        { headers: {} },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string }; workspaceSlug: string };
      expect(json).toHaveProperty("user");
      expect(json).toHaveProperty("workspaceSlug");
      expect(json.user).toHaveProperty("email", "newregistrant@example.com");
    });

    it("should return 404 for invalid token", async () => {
      const { client } = getCtx();
      const res = await client.api.invitations[":token"].register.$post(
        {
          param: { token: "invalid-token" },
          json: {
            name: "Test User",
            password: "password123",
          },
        },
        { headers: {} },
      );

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid name", async () => {
      const { client, headers } = getCtx();

      const createRes = await client.api.invitations.$post(
        { json: { email: "shortname@example.com" } },
        { headers: headers() },
      );
      const createJson = await createRes.json();
      const token = createJson.invitation.token;

      const res = await client.api.invitations[":token"].register.$post(
        {
          param: { token },
          json: {
            name: "A",
            password: "password123",
          },
        },
        { headers: {} },
      );

      expect(res.status).toBe(400);
    });
  });
});
