import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import type { SignupEmail } from "@blackwall/shared";
import { Effect } from "effect";
import { runApi } from "../../test/api";
import { seedTestSetup } from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";
import { env } from "../../lib/env";
import { handleRequest } from "../../index";

const signup = (overrides: Partial<SignupEmail> = {}): SignupEmail => ({
  email: "newuser@example.com",
  password: "password123",
  name: "New User",
  workspaceDisplayName: "My Workspace",
  workspaceUrlSlug: "my-workspace",
  ...overrides,
});

// The typed client validates payloads and hides headers, so these go through raw requests.
const postSignup = (body: unknown) =>
  handleRequest(
    new Request(`${env.APP_BASE_URL}/api/auth/signup/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("auth api", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  test("signs up a user with a workspace and a team they own", async () => {
    const { user, workspace, team } = await runApi({}, (client) =>
      client.auth.signupEmail({ payload: signup() }),
    );

    expect(user).toMatchObject({ email: "newuser@example.com", name: "New User" });
    expect(workspace).toMatchObject({ displayName: "My Workspace", slug: "my-workspace" });
    expect(team).toMatchObject({ name: "My Workspace", workspaceId: workspace.id });
    const membership = await testDb.db.query.workspaceUser.findFirst({
      where: { workspaceId: workspace.id, userId: user.id },
    });
    expect(membership?.role).toBe("owner");
  });

  test("sets a session cookie that signs the user in", async () => {
    const response = await postSignup(signup());

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("better-auth.session_token=");
    const { workspaces } = await runApi({ cookie: cookie! }, (client) => client.workspaces.list());
    expect(workspaces.map((workspace) => workspace.slug)).toEqual(["my-workspace"]);
  });

  test("rejects an email that already has an account", async () => {
    await seedTestSetup(testDb);

    const error = await runApi({}, (client) =>
      Effect.flip(client.auth.signupEmail({ payload: signup({ email: "test@example.com" }) })),
    );

    expect(error).toMatchObject({ _tag: "UserAlreadyExists", code: "USER_ALREADY_EXISTS" });
    const workspace = await testDb.db.query.workspace.findFirst({
      where: { slug: "my-workspace" },
    });
    expect(workspace).toBeUndefined();
  });

  test("rejects a taken slug without signing the user in", async () => {
    await seedTestSetup(testDb);

    const response = await postSignup(signup({ workspaceUrlSlug: "test-workspace" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "WORKSPACE_SLUG_TAKEN" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test.each([
    ["an invalid email", { email: "not-an-email" }],
    ["a short password", { password: "short" }],
    ["a short name", { name: "X" }],
    ["a malformed slug", { workspaceUrlSlug: "INVALID_SLUG!" }],
    ["the reserved slug", { workspaceUrlSlug: "api" }],
    ["a short workspace name", { workspaceDisplayName: "X" }],
  ])("rejects %s with a coded 400", async (_, overrides) => {
    const response = await postSignup(signup(overrides));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
