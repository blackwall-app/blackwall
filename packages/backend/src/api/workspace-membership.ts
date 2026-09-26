import {
  CurrentUser,
  CurrentWorkspace,
  MissingWorkspaceHeader,
  WORKSPACE_SLUG_HEADER,
  WorkspaceMembership,
} from "@blackwall/shared";
import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";

export const WorkspaceMembershipLive = Layer.effect(
  WorkspaceMembership,
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceService;

    return WorkspaceMembership.of((httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const slug = request.headers[WORKSPACE_SLUG_HEADER];
        if (!slug) {
          return yield* new MissingWorkspaceHeader();
        }
        const user = yield* CurrentUser;
        const workspace = yield* workspaces.requireWorkspace(slug, user.id);
        return yield* Effect.provideService(httpEffect, CurrentWorkspace, {
          id: workspace.id,
          slug: workspace.slug,
          displayName: workspace.displayName,
          logoUrl: workspace.logoUrl,
        });
      }),
    );
  }),
);
