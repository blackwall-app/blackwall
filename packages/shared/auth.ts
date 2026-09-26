import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import {
  MissingWorkspaceHeader,
  NotWorkspaceMember,
  Unauthorized,
  WorkspaceNotFound,
} from "./errors";

export const WORKSPACE_SLUG_HEADER = "x-blackwall-workspace-slug";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly lastWorkspaceId: string | null;
  readonly lastTeamId: string | null;
}

export class CurrentUser extends Context.Service<CurrentUser, SessionUser>()(
  "blackwall/CurrentUser",
) {}

/**
 * Requires a better-auth session. Clients must provide a `layerClient` for it,
 * which lets tests attach the session cookie. Browsers send the cookie on their
 * own, so the frontend's client middleware passes the request through.
 */
export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  {
    provides: CurrentUser;
    requires: never;
  }
>()("blackwall/Authorization", {
  security: {
    session: HttpApiSecurity.apiKey({
      in: "cookie",
      key: "better-auth.session_token",
    }),
  },
  error: Unauthorized,
  requiredForClient: true,
}) {}

export interface WorkspaceContext {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly logoUrl: string | null;
}

export class CurrentWorkspace extends Context.Service<CurrentWorkspace, WorkspaceContext>()(
  "blackwall/CurrentWorkspace",
) {}

/**
 * Resolves the workspace named by the `x-blackwall-workspace-slug` header and
 * checks that the current user belongs to it. Add it to a group before
 * `Authorization`, so `Authorization` runs first and provides `CurrentUser`:
 *
 * ```ts
 * HttpApiGroup.make("labels")
 *   .add(...)
 *   .middleware(WorkspaceMembership)
 *   .middleware(Authorization)
 * ```
 *
 * Clients must provide a `layerClient` that sets the header.
 */
export class WorkspaceMembership extends HttpApiMiddleware.Service<
  WorkspaceMembership,
  {
    provides: CurrentWorkspace;
    requires: CurrentUser;
  }
>()("blackwall/WorkspaceMembership", {
  error: [MissingWorkspaceHeader, WorkspaceNotFound, NotWorkspaceMember],
  requiredForClient: true,
}) {}
