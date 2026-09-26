import { describe, expect, test } from "bun:test";
import "../../test/env.test";
import {
  Api,
  Authorization,
  CurrentUser,
  Unauthorized,
  WorkspaceNotFound,
} from "@blackwall/shared";
import type { Team, Workspace as WorkspaceRow } from "@blackwall/database/schema";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { HttpApiTest } from "effect/unstable/httpapi";
import { WorkspaceService } from "../../features/workspaces/WorkspaceService";
import { WorkspacesHandlersNoDeps } from "../workspaces";

const rows: Array<WorkspaceRow> = [{ displayName: "One", id: "ws-1", logoUrl: null, slug: "one" }];

const team: Team = {
  avatar: null,
  createdAt: new Date("2026-01-01"),
  deletedAt: null,
  id: "team-1",
  key: "ONE",
  name: "One",
  updatedAt: new Date("2026-01-01"),
  workspaceId: "ws-1",
};

const FakeWorkspaces = Layer.succeed(
  WorkspaceService,
  WorkspaceService.of({
    createWorkspace: (input) =>
      Effect.succeed({
        team,
        workspace: { ...input, id: "ws-new", logoUrl: null },
      }),
    getPreferredWorkspaceForUser: () => Effect.succeed(rows[0] ?? null),
    isWorkspaceMember: () => Effect.succeed(true),
    listUserWorkspaces: () => Effect.succeed(rows),
    requireWorkspace: (slug) => {
      const found = rows.find((row) => row.slug === slug);
      return found === undefined
        ? Effect.fail(new WorkspaceNotFound({ message: "Workspace not found" }))
        : Effect.succeed(found);
    },
    saveLastWorkspaceForUser: () => Effect.void,
    updateWorkspace: (input) => Effect.succeed(rows.find((row) => row.id === input.workspaceId)),
  }),
);

const AuthedAuthorization = Layer.effect(
  Authorization,
  Effect.succeed(
    Authorization.of({
      session: (httpEffect) =>
        Effect.provideService(httpEffect, CurrentUser, {
          email: "test@example.com",
          id: "user-1",
          name: "Test",
        }),
    }),
  ),
);

const AnonymousAuthorization = Layer.effect(
  Authorization,
  Effect.succeed(
    Authorization.of({
      session: () => Effect.fail(new Unauthorized({ message: "Unauthorized" })),
    }),
  ),
);

const liveWith = (authorizationLayer: Layer.Layer<Authorization>) =>
  Layer.mergeAll(
    WorkspacesHandlersNoDeps.pipe(
      Layer.provide(FakeWorkspaces),
      Layer.provideMerge(authorizationLayer),
    ),
    HttpServer.layerServices,
  );

const AuthedLive = liveWith(AuthedAuthorization);
const AnonymousLive = liveWith(AnonymousAuthorization);

const makeClient = HttpApiTest.groups(Api, ["workspaces"]);

describe("workspaces effect api", () => {
  test("lists workspaces for the session user", async () => {
    const result = await Effect.runPromise(
      makeClient.pipe(
        Effect.flatMap((client) => client.workspaces.list()),
        Effect.provide(AuthedLive),
        Effect.scoped,
      ),
    );
    expect(result.workspaces.map((workspace) => workspace.slug)).toEqual(["one"]);
  });

  test("creates a workspace", async () => {
    const result = await Effect.runPromise(
      makeClient.pipe(
        Effect.flatMap((client) =>
          client.workspaces.create({ payload: { displayName: "Two", slug: "two" } }),
        ),
        Effect.provide(AuthedLive),
        Effect.scoped,
      ),
    );
    expect(result.workspace.slug).toBe("two");
  });

  test("returns a typed not-found error for an unknown slug", async () => {
    const error = await Effect.runPromise(
      makeClient.pipe(
        Effect.flatMap((client) => client.workspaces.getBySlug({ params: { slug: "nope" } })),
        Effect.flip,
        Effect.provide(AuthedLive),
        Effect.scoped,
      ),
    );
    expect(error._tag).toBe("WorkspaceNotFound");
  });

  test("returns a typed unauthorized error without a session", async () => {
    const error = await Effect.runPromise(
      makeClient.pipe(
        Effect.flatMap((client) => client.workspaces.list()),
        Effect.flip,
        Effect.provide(AnonymousLive),
        Effect.scoped,
      ),
    );
    expect(error._tag).toBe("Unauthorized");
  });
});
