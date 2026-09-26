import { Context } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import { Unauthorized } from "./effect-errors";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export class CurrentUser extends Context.Service<CurrentUser, SessionUser>()(
  "blackwall/CurrentUser",
) {}

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
}) {}
