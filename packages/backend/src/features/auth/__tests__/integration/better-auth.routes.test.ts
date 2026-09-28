import "../../../../test/env.test";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { testClient } from "hono/testing";
import { app } from "../../../../index";
import { createTestDb, cleanupTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";
import { env } from "../../../../lib/zod-env";

describe("better-auth routes", () => {
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
            Origin: env.APP_BASE_URL,
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
            Origin: env.APP_BASE_URL,
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
      const res = await client.api.issues[":issueKey"].attachments[":attachmentId"].$get({
        param: { issueKey: "TES-1", attachmentId: "missing" },
      });

      expect(res.status).toBe(401);
    });
  });
});
