import "../../../../test/env.test";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { app } from "../../../../index";
import { createTestDb, cleanupTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";
import { env } from "../../../../lib/env";

const request = (
  method: "GET" | "POST",
  path: string,
  options: { cookie?: string; json?: unknown } = {},
) => {
  const headers = new Headers({ Origin: env.APP_BASE_URL });
  if (options.cookie) headers.set("Cookie", options.cookie);
  const init: RequestInit = { method, headers };
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.json);
  }
  return app.fetch(new Request(`${env.APP_BASE_URL}/api/better-auth${path}`, init));
};

describe("better-auth routes", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    if (testDb) {
      cleanupTestDb(testDb);
    }
  });

  describe("POST /api/better-auth/sign-in/email", () => {
    it("should sign in with valid credentials", async () => {
      const { password } = await seedTestSetup(testDb);

      const res = await request("POST", "/sign-in/email", {
        json: { email: "test@example.com", password },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string } };
      expect(json.user.email).toBe("test@example.com");
    });

    it("should set session cookie on sign in", async () => {
      const { password } = await seedTestSetup(testDb);

      const res = await request("POST", "/sign-in/email", {
        json: { email: "test@example.com", password },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toContain("better-auth.session_token");
    });

    it("should return 401 for invalid password", async () => {
      await seedTestSetup(testDb);

      const res = await request("POST", "/sign-in/email", {
        json: { email: "test@example.com", password: "wrongpassword" },
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 for non-existent user", async () => {
      const res = await request("POST", "/sign-in/email", {
        json: { email: "nonexistent@example.com", password: "password123" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/better-auth/get-session", () => {
    it("should return session for authenticated user", async () => {
      const { cookie } = await seedTestSetup(testDb);

      const res = await request("GET", "/get-session", { cookie });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string }; session: { id: string } };
      expect(json.user.email).toBe("test@example.com");
      expect(json.session).toBeDefined();
    });

    it("should return null for unauthenticated request", async () => {
      const res = await request("GET", "/get-session");

      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
  });

  describe("POST /api/better-auth/sign-out", () => {
    it("should sign out authenticated user", async () => {
      const { cookie } = await seedTestSetup(testDb);

      const res = await request("POST", "/sign-out", { cookie });

      expect(res.status).toBe(200);
    });

    it("should invalidate session after sign out", async () => {
      const { cookie } = await seedTestSetup(testDb);

      await request("POST", "/sign-out", { cookie });
      const sessionRes = await request("GET", "/get-session", { cookie });

      expect(sessionRes.status).toBe(200);
      expect(await sessionRes.json()).toBeNull();
    });
  });
});
