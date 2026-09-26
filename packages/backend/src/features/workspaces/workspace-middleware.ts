import { ErrorCode } from "@blackwall/shared";
import { createMiddleware } from "hono/factory";
import { runtime } from "../../lib/effect/runtime";
import { BadRequestError, UnauthorizedError } from "../../lib/errors";
import { WorkspaceService } from "./WorkspaceService";

export const workspaceMiddleware = createMiddleware(async (c, next) => {
  const workspaceSlug = c.req.header("x-blackwall-workspace-slug");
  if (!workspaceSlug) {
    throw new BadRequestError(
      "Missing required header: x-blackwall-workspace-slug",
      ErrorCode.MISSING_WORKSPACE_HEADER,
    );
  }

  const user = c.get("user");
  if (!user) {
    throw new UnauthorizedError("Unauthorized");
  }

  const workspace = await runtime.runPromise(
    WorkspaceService.use((workspaces) => workspaces.requireWorkspace(workspaceSlug, user.id)),
  );

  c.set("workspace", workspace);

  await next();
});
