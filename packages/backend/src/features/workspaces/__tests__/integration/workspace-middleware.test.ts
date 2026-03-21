import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";
import { errorHandler } from "../../../../lib/error-handler";
import { workspaceMiddleware } from "../../workspace-middleware";

describe("workspaceMiddleware", () => {
  let testDb: TestDb;
  let workspaceId: string;
  let workspaceSlug: string;
  let userId: string;

  beforeEach(async () => {
    testDb = await createTestDb();

    const { workspace, user } = await seedTestSetup(testDb);
    workspaceId = workspace.id;
    workspaceSlug = workspace.slug;
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestDb(testDb);
  });

  function createApp() {
    const app = new Hono<{
      Variables: {
        user: { id: string };
        workspace: { id: string };
      };
    }>();

    app.onError(errorHandler);

    app.use(async (c, next) => {
      const requestUserId = c.req.header("x-user-id");
      if (requestUserId) {
        c.set("user", { id: requestUserId });
      }
      await next();
    });

    app.use(workspaceMiddleware);

    app.get("/", (c) => {
      const workspace = c.get("workspace");
      return c.json({ workspaceId: workspace.id });
    });

    return app;
  }

  it("returns 400 when the workspace header is missing", async () => {
    const response = await createApp().request("http://localhost/", {
      headers: {
        "x-user-id": userId,
      },
    });

    expect(response.status).toBe(400);
    const bad400 = (await response.json()) as { code: string; message: string };
    expect(bad400.code).toBe("MISSING_WORKSPACE_HEADER");
    expect(bad400.message).toContain("Missing required header");
  });

  it("returns 401 when the user is missing", async () => {
    const response = await createApp().request("http://localhost/", {
      headers: {
        "x-blackwall-workspace-slug": workspaceSlug,
      },
    });

    expect(response.status).toBe(401);
    const unauthorized = (await response.json()) as { code: string; message: string };
    expect(unauthorized.code).toBe("UNAUTHORIZED");
    expect(unauthorized.message).toBe("Unauthorized");
  });

  it("loads the workspace into the context for members", async () => {
    const response = await createApp().request("http://localhost/", {
      headers: {
        "x-blackwall-workspace-slug": workspaceSlug,
        "x-user-id": userId,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspaceId });
  });
});
