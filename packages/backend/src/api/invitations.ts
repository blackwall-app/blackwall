import { Api, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Auth, forwardAuthCookies } from "../features/auth/Auth";
import { InvitationService } from "../features/invitations/InvitationService";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";

export const InvitationsHandlers = HttpApiBuilder.group(
  Api,
  "invitations",
  Effect.fn(function* (handlers) {
    const auth = yield* Auth;
    const invitations = yield* InvitationService;
    const workspaces = yield* WorkspaceService;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const { invitation, token, invitationUrl } = yield* invitations.createInvitation({
            workspace,
            inviter: user,
            email: payload.email,
          });
          return {
            message: "Invitation sent successfully.",
            invitation: { ...invitation, token },
            invitationUrl,
          };
        }),
      get: ({ params }) =>
        Effect.gen(function* () {
          const invitation = yield* invitations.requirePendingInvitation(params.token);
          const request = yield* HttpServerRequest.HttpServerRequest;
          const session = yield* auth.getSession(request.headers).pipe(Effect.orDie);
          const isMember =
            session !== null &&
            (yield* workspaces.isWorkspaceMember({
              userId: session.user.id,
              workspaceId: invitation.workspaceId,
            }));
          return {
            invitation: {
              email: invitation.email,
              isMember,
              workspace: {
                displayName: invitation.workspace.displayName,
                slug: invitation.workspace.slug,
              },
            },
          };
        }),
      register: ({ params, payload }) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const { user, headers, workspaceSlug } = yield* invitations.registerWithInvitation({
            token: params.token,
            name: payload.name,
            password: payload.password,
            headers: request.headers,
          });
          yield* forwardAuthCookies(headers);
          return { user, workspaceSlug };
        }),
      accept: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const { workspaceSlug } = yield* invitations.acceptInvitation({
            token: params.token,
            userId: user.id,
            userEmail: user.email,
          });
          return { message: "Invitation accepted successfully.", workspaceSlug };
        }),
    });
  }),
);
