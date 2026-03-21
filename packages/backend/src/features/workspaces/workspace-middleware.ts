import { ErrorCode } from "@blackwall/shared";
import { createMiddleware } from "hono/factory";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import { workspaceService } from "./workspace.service";

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

  const workspace = await workspaceService.getWorkspaceBySlug(workspaceSlug, user.id);

  if (!workspace) {
    throw new NotFoundError("Workspace not found", ErrorCode.WORKSPACE_NOT_FOUND);
  }

  c.set("workspace", workspace);

  await next();
});
