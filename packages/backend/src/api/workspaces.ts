import { Api, CurrentUser } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";

export const WorkspacesHandlers = HttpApiBuilder.group(
  Api,
  "workspaces",
  Effect.fn(function* (handlers) {
    const workspaces = yield* WorkspaceService;

    return handlers.handleAll({
      list: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          return { workspaces: yield* workspaces.listUserWorkspaces({ userId: user.id }) };
        }),
      create: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const { workspace } = yield* workspaces.createWorkspace({ ...payload, ownerId: user.id });
          return { workspace };
        }),
      preferred: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          return { workspace: yield* workspaces.getPreferredWorkspaceForUser({ user }) };
        }),
      getBySlug: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* workspaces.requireWorkspace(params.slug, user.id);
          yield* workspaces.saveLastWorkspaceForUser({
            userId: user.id,
            workspaceId: workspace.id,
          });
          return { workspace };
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* workspaces.updateWorkspace({
            actorId: user.id,
            workspaceId: params.workspaceId,
            displayName: payload.displayName,
          });
          return { workspace };
        }),
      listMembers: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          return {
            members: yield* workspaces.listMembers({ slug: params.slug, actorId: user.id }),
          };
        }),
      getMember: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const member = yield* workspaces.getMember({
            slug: params.slug,
            actorId: user.id,
            userId: params.userId,
          });
          return { member };
        }),
    });
  }),
);
