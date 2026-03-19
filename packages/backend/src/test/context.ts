import { beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import { createTestDb, cleanupTestDb, type TestDb } from "./setup";
import { seedTestSetup } from "./fixtures";
import type { Team, User, Workspace } from "@blackwall/database/schema";
import { testClient } from "hono/testing";

type TestClient = ReturnType<typeof testClient<typeof app>>;

/**
 * Test context containing all common test dependencies.
 */
export interface TestContext {
  /** The Hono test client */
  client: TestClient;
  /** The test database instance */
  testDb: TestDb;
  /** Session cookie from signin */
  sessionCookie: string;
  /** Workspace from signin */
  workspace: Workspace;
  /** Team from signin */
  team: Team;
  /** User from signin */
  user: User;
  /** Creates headers with session cookie and workspace slug */
  headers: () => Record<string, string>;
  /** Creates headers with session cookie only (no workspace) */
  headersWithoutWorkspace: () => Record<string, string>;
}

/**
 * Creates a test context with automatic setup and teardown.
 *
 * This hook registers beforeEach/afterEach handlers that:
 * - Create a fresh test database
 * - Sign up a test user with workspace and team
 * - Clean up the database after each test
 *
 */
export function useTestContext(): () => TestContext {
  let ctx: TestContext;

  beforeEach(async () => {
    const testDb = await createTestDb();
    const client = testClient(app);
    const { user, workspace, team, cookie } = await seedTestSetup(testDb);

    ctx = {
      client,
      testDb,
      sessionCookie: cookie,
      workspace,
      team,
      user,
      headers: () => createSessionHeaders(cookie, workspace.slug),
      headersWithoutWorkspace: () => createSessionHeaders(cookie),
    };
  });

  afterEach(async () => {
    if (ctx?.testDb) {
      cleanupTestDb(ctx.testDb);
    }
  });

  return () => ctx;
}

function createSessionHeaders(cookie: string, workspaceSlug?: string) {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
    ...(workspaceSlug ? { "x-blackwall-workspace-slug": workspaceSlug } : {}),
  };
}
