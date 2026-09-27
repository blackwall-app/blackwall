import { Api } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Auth, forwardAuthCookies } from "../features/auth/Auth";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";

export const AuthHandlers = HttpApiBuilder.group(
  Api,
  "auth",
  Effect.fn(function* (handlers) {
    const auth = yield* Auth;
    const workspaces = yield* WorkspaceService;

    return handlers.handleAll({
      // better-auth hooks can't take the workspace fields, so the workspace is
      // created here after better-auth creates the user.
      signupEmail: ({ payload }) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const { user, headers } = yield* auth
            .signUpEmail({
              email: payload.email,
              name: payload.name,
              password: payload.password,
              headers: request.headers,
            })
            .pipe(Effect.catchTag("AuthError", Effect.die));
          const { workspace, team } = yield* workspaces.createWorkspace({
            displayName: payload.workspaceDisplayName,
            slug: payload.workspaceUrlSlug,
            ownerId: user.id,
          });
          yield* forwardAuthCookies(headers);
          return { user, workspace, team };
        }),
    });
  }),
);
