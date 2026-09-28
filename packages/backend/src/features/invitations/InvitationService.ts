import { Database } from "@blackwall/database/effect";
import type { Workspace, WorkspaceInvitation } from "@blackwall/database/schema";
import { jobService } from "@blackwall/queue";
import {
  InvitationEmailMismatch,
  InvitationNotFoundOrExpired,
  type User,
  type UserAlreadyExists,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { env } from "../../lib/env";
import { Auth, type RequestHeaders } from "../auth/Auth";
import { WorkspaceService } from "../workspaces/WorkspaceService";
import { invitationData } from "./invitation.data";

type PendingInvitation = WorkspaceInvitation & { workspace: Workspace };

/**
 * Any workspace member can invite anyone by email. The invitation is used up
 * once someone accepts it, and expires after 7 days either way.
 */
export class InvitationService extends Context.Service<
  InvitationService,
  {
    /** Also queues an `invite-email` job with the link. */
    readonly createInvitation: (input: {
      workspace: { id: string; displayName: string };
      inviter: { id: string; name: string };
      email: string;
    }) => Effect.Effect<{
      invitation: WorkspaceInvitation;
      token: string;
      invitationUrl: string;
    }>;
    readonly requirePendingInvitation: (
      token: string,
    ) => Effect.Effect<PendingInvitation, InvitationNotFoundOrExpired>;
    /** For a signed-in user, who must have the invited email address. */
    readonly acceptInvitation: (input: {
      token: string;
      userId: string;
      userEmail: string;
    }) => Effect.Effect<
      { workspaceSlug: string },
      InvitationNotFoundOrExpired | InvitationEmailMismatch
    >;
    /**
     * Signs up a new user with the invited email address and accepts the
     * invitation for them. `headers` holds the session cookie.
     */
    readonly registerWithInvitation: (input: {
      token: string;
      name: string;
      password: string;
      headers: RequestHeaders;
    }) => Effect.Effect<
      { user: User; headers: globalThis.Headers; workspaceSlug: string },
      InvitationNotFoundOrExpired | UserAlreadyExists
    >;
  }
>()("blackwall/InvitationService") {
  static readonly layer = Layer.effect(
    InvitationService,
    Effect.gen(function* () {
      const database = yield* Database;
      const auth = yield* Auth;
      const workspaces = yield* WorkspaceService;

      const createInvitation = Effect.fn("InvitationService.createInvitation")(
        function* (input: {
          workspace: { id: string; displayName: string };
          inviter: { id: string; name: string };
          email: string;
        }) {
          const { invitation, token } = yield* database.use((db) =>
            invitationData.createInvitation(
              {
                workspaceId: input.workspace.id,
                createdById: input.inviter.id,
                email: input.email,
              },
              db,
            ),
          );
          const invitationUrl = `${env.APP_BASE_URL}/invite/${token}`;

          yield* Effect.tryPromise(() =>
            jobService.addJob({
              type: "invite-email",
              payload: {
                email: input.email,
                workspaceName: input.workspace.displayName,
                inviterName: input.inviter.name,
                invitationUrl,
              },
            }),
          ).pipe(Effect.orDie);

          return { invitation, token, invitationUrl };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const requirePendingInvitation = Effect.fn("InvitationService.requirePendingInvitation")(
        function* (token: string) {
          const invitation = yield* database.use((db) =>
            invitationData.getPendingInvitationByToken(token, db),
          );
          if (invitation === undefined || invitation.expiresAt < new Date()) {
            return yield* new InvitationNotFoundOrExpired();
          }
          return invitation;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const join = Effect.fn("InvitationService.join")(
        function* (invitation: PendingInvitation, userId: string) {
          yield* workspaces.addMember({ userId, workspaceId: invitation.workspaceId });
          yield* database.use((db) =>
            invitationData.markInvitationAccepted({ invitationId: invitation.id, userId }, db),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const acceptInvitation = Effect.fn("InvitationService.acceptInvitation")(function* (input: {
        token: string;
        userId: string;
        userEmail: string;
      }) {
        const invitation = yield* requirePendingInvitation(input.token);
        if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase()) {
          return yield* new InvitationEmailMismatch();
        }
        yield* join(invitation, input.userId);
        return { workspaceSlug: invitation.workspace.slug };
      });

      const registerWithInvitation = Effect.fn("InvitationService.registerWithInvitation")(
        function* (input: {
          token: string;
          name: string;
          password: string;
          headers: RequestHeaders;
        }) {
          const invitation = yield* requirePendingInvitation(input.token);
          const { user, headers } = yield* auth.signUpEmail({
            email: invitation.email,
            name: input.name,
            password: input.password,
            headers: input.headers,
          });
          yield* join(invitation, user.id);
          return { user, headers, workspaceSlug: invitation.workspace.slug };
        },
        Effect.catchTag("AuthError", Effect.die),
      );

      return InvitationService.of({
        createInvitation,
        requirePendingInvitation,
        acceptInvitation,
        registerWithInvitation,
      });
    }),
  );
}
