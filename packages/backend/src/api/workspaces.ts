import {
  Api,
  CurrentUser,
  Workspace,
  WorkspaceListResponse,
  WorkspaceNotFound,
  WorkspaceResponse,
} from "@blackwall/shared";
import type { Workspace as WorkspaceRow } from "@blackwall/database/schema";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Auth } from "../features/auth/Auth";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";
import { AuthorizationLive } from "./authorization";

export const WorkspacesHandlersNoDeps = HttpApiBuilder.group(
  Api,
  "workspaces",
  Effect.fn(function* (handlers) {
    const workspaces = yield* WorkspaceService;

    const toWorkspace = (row: WorkspaceRow) => new Workspace(row);

    return handlers.handleAll({
      list: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* workspaces.listUserWorkspaces({ userId: user.id });
          return new WorkspaceListResponse({
            workspaces: rows.map(toWorkspace),
          });
        }),
      create: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const { workspace } = yield* workspaces.createWorkspace({ ...payload, ownerId: user.id });
          return new WorkspaceResponse({ workspace: toWorkspace(workspace) });
        }),
      getBySlug: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* workspaces.requireWorkspace(params.slug, user.id);
          yield* workspaces.saveLastWorkspaceForUser({
            userId: user.id,
            workspaceId: workspace.id,
          });
          return new WorkspaceResponse({ workspace: toWorkspace(workspace) });
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* workspaces.updateWorkspace({
            actorId: user.id,
            workspaceId: params.workspaceId,
            displayName: payload.displayName,
          });
          if (workspace === undefined) {
            return yield* new WorkspaceNotFound({
              message: "Workspace not found",
            });
          }
          return new WorkspaceResponse({ workspace: toWorkspace(workspace) });
        }),
    });
  }),
);

export const WorkspacesHandlers = WorkspacesHandlersNoDeps.pipe(
  Layer.provide(Layer.mergeAll(WorkspaceService.layer, Auth.layer)),
  Layer.provideMerge(AuthorizationLive),
);
