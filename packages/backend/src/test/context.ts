import { beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import { createTestDb, cleanupTestDb, type TestDb } from "./setup";
import { seedTestSetup } from "./fixtures";
import type { Team, User, Workspace } from "@blackwall/database/schema";
import { testClient } from "hono/testing";

type TestClient = ReturnType<typeof testClient<typeof app>>;

export interface TestContext {
  client: TestClient;
  testDb: TestDb;
  sessionCookie: string;
  workspace: Workspace;
  team: Team;
  user: User;
  headers: () => Record<string, string>;
  headersWithoutWorkspace: () => Record<string, string>;
}

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
