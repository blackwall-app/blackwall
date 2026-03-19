import "../../../../test/env.test";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { testClient } from "hono/testing";
import { app } from "../../../../index";
import { createTestDb, cleanupTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";

describe("Auth Routes", () => {
  let testDb: TestDb;
  let client: ReturnType<typeof testClient<typeof app>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    client = testClient(app);
  });

  afterEach(() => {
    if (testDb) {
      cleanupTestDb(testDb);
    }
  });

  describe("POST /auth/signup/email", () => {
    it("should create user, workspace, and team on signup", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "newuser@example.com",
          password: "password123",
          name: "New User",
          workspaceDisplayName: "My Workspace",
          workspaceUrlSlug: "my-workspace",
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user).toBeDefined();
      expect(json.user.email).toBe("newuser@example.com");
      expect(json.user.name).toBe("New User");
      expect(json.workspace).toBeDefined();
      expect(json.workspace.displayName).toBe("My Workspace");
      expect(json.workspace.slug).toBe("my-workspace");
      expect(json.team).toBeDefined();
      expect(json.team.name).toBe("My Workspace");
    });

    it("should set session cookie on signup", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "cookieuser@example.com",
          password: "password123",
          name: "Cookie User",
          workspaceDisplayName: "Cookie Workspace",
          workspaceUrlSlug: "cookie-workspace",
        },
      });

      expect(res.status).toBe(200);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("better-auth.session_token");
    });

    it("should return 400 for invalid email", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "not-an-email",
          password: "password123",
          name: "Test User",
          workspaceDisplayName: "Test Workspace",
          workspaceUrlSlug: "test-workspace",
        },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short password", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "test@example.com",
          password: "short",
          name: "Test User",
          workspaceDisplayName: "Test Workspace",
          workspaceUrlSlug: "test-workspace",
        },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short name", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "test@example.com",
          password: "password123",
          name: "X",
          workspaceDisplayName: "Test Workspace",
          workspaceUrlSlug: "test-workspace",
        },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid workspace slug format", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "test@example.com",
          password: "password123",
          name: "Test User",
          workspaceDisplayName: "Test Workspace",
          workspaceUrlSlug: "INVALID_SLUG!",
        },
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short workspace display name", async () => {
      const res = await client.api.auth.signup.email.$post({
        json: {
          email: "test@example.com",
          password: "password123",
          name: "Test User",
          workspaceDisplayName: "X",
          workspaceUrlSlug: "test-workspace",
        },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/sign-in/email (better-auth)", () => {
    it("should sign in with valid credentials", async () => {
      const { password } = await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["sign-in"].email.$post({
        json: {
          email: "test@example.com",
          password: password,
        },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string } };
      expect(json.user.email).toBe("test@example.com");
    });

    it("should set session cookie on sign in", async () => {
      const { password } = await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["sign-in"].email.$post({
        json: {
          email: "test@example.com",
          password: password,
        },
      });

      expect(res.status).toBe(200);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain("better-auth.session_token");
    });

    it("should return 401 for invalid password", async () => {
      await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["sign-in"].email.$post({
        json: {
          email: "test@example.com",
          password: "wrongpassword",
        },
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 for non-existent user", async () => {
      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["sign-in"].email.$post({
        json: {
          email: "nonexistent@example.com",
          password: "password123",
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/get-session (better-auth)", () => {
    it("should return session for authenticated user", async () => {
      const { cookie } = await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["get-session"].$get(
        {},
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string }; session: { id: string } };
      expect(json.user).toBeDefined();
      expect(json.user.email).toBe("test@example.com");
      expect(json.session).toBeDefined();
    });

    it("should return null for unauthenticated request", async () => {
      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["get-session"].$get({});

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toBeNull();
    });
  });

  describe("POST /api/auth/sign-out (better-auth)", () => {
    it("should sign out authenticated user", async () => {
      const { cookie } = await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      const res = await client.api["better-auth"]["sign-out"].$post(
        {},
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      expect(res.status).toBe(200);
    });

    it("should invalidate session after sign out", async () => {
      const { cookie } = await seedTestSetup(testDb);

      // @ts-expect-error - better-auth wildcard route has no type inference
      await client.api["better-auth"]["sign-out"].$post(
        {},
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      // @ts-expect-error - better-auth wildcard route has no type inference
      const sessionRes = await client.api["better-auth"]["get-session"].$get(
        {},
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

      expect(sessionRes.status).toBe(200);
      const json = await sessionRes.json();
      expect(json).toBeNull();
    });
  });

  describe("Protected routes without auth", () => {
    it("should return 401 when accessing protected route without session", async () => {
      const res = await client.api.workspaces.$get({});

      expect(res.status).toBe(401);
    });
  });
});
