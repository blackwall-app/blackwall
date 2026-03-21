import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "../../lib/errors";
import { auth } from "./better-auth";

export type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    throw new UnauthorizedError("Unauthorized");
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});
