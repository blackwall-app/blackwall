import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import {
  Authorization,
  CurrentWorkspace,
  WorkspaceMembership,
  WORKSPACE_SLUG_HEADER,
} from "@blackwall/shared";
import { Effect, Layer, Schema } from "effect";
import { HttpClientRequest, HttpServer } from "effect/unstable/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiTest,
} from "effect/unstable/httpapi";
import { MiddlewareLive } from "../handlers";
import { handleApiRequest } from "../index";
import { AppLayer } from "../../lib/effect/runtime";
import { createWorkspace, seedTestSetup } from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";
import { env } from "../../lib/env";

// A one-endpoint API that echoes the workspace `WorkspaceMembership` resolved.
class ProbeApi extends HttpApi.make("probe").add(
  HttpApiGroup.make("probe")
    .add(HttpApiEndpoint.get("workspace", "/", { success: Schema.Struct({ slug: Schema.String }) }))
    .middleware(WorkspaceMembership)
    .middleware(Authorization),
) {}

const ProbeHandlers = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
  handlers.handle("workspace", () =>
    Effect.gen(function* () {
      const workspace = yield* CurrentWorkspace;
      return { slug: workspace.slug };
    }),
  ),
);

const probe = (headers: { cookie?: string; slug?: string }) =>
  Effect.runPromise(
    HttpApiTest.groups(ProbeApi, ["probe"]).pipe(
      Effect.flatMap((client) => Effect.result(client.probe.workspace())),
      Effect.provide(
        Layer.mergeAll(
          HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
            next(HttpClientRequest.setHeader(request, "cookie", headers.cookie ?? "")),
          ),
          HttpApiMiddleware.layerClient(WorkspaceMembership, ({ next, request }) =>
            next(
              headers.slug === undefined
                ? request
                : HttpClientRequest.setHeader(request, WORKSPACE_SLUG_HEADER, headers.slug),
            ),
          ),
        ),
      ),
      Effect.provide(
        Layer.mergeAll(
          ProbeHandlers.pipe(Layer.provideMerge(MiddlewareLive)),
          HttpServer.layerServices,
        ).pipe(Layer.provide(AppLayer)),
      ),
      Effect.scoped,
    ),
  );

describe("WorkspaceMembership", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  test("provides the workspace named by the header", async () => {
    const result = await probe({ cookie: seed.cookie, slug: seed.workspace.slug });
    expect(result).toMatchObject({ _tag: "Success", success: { slug: seed.workspace.slug } });
  });

  test("requires the header", async () => {
    const result = await probe({ cookie: seed.cookie });
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "MissingWorkspaceHeader", code: "MISSING_WORKSPACE_HEADER" },
    });
  });

  test("rejects unknown workspaces and non-members", async () => {
    await createWorkspace(testDb, { slug: "private", displayName: "Private" });

    const missing = await probe({ cookie: seed.cookie, slug: "nope" });
    const forbidden = await probe({ cookie: seed.cookie, slug: "private" });

    expect(missing).toMatchObject({ failure: { _tag: "WorkspaceNotFound" } });
    expect(forbidden).toMatchObject({ failure: { _tag: "NotWorkspaceMember" } });
  });

  test("checks the session before the workspace", async () => {
    const result = await probe({ slug: seed.workspace.slug });
    expect(result).toMatchObject({ failure: { _tag: "Unauthorized" } });
  });
});

describe("RequestValidation", () => {
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    seed = await seedTestSetup(await createTestDb());
  });

  // The typed client validates payloads before sending, so post raw JSON.
  test("turns a bad payload into a coded 400", async () => {
    const response = await handleApiRequest(
      new Request(`${env.APP_BASE_URL}/api/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: seed.cookie },
        body: JSON.stringify({ displayName: "Api", slug: "api" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      _tag: "ValidationError",
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("api"),
    });
  });
});
