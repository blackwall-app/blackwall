import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { workspaceService } from "./workspace.service";

export const workspaceMiddleware = createMiddleware(async (c, next) => {
  const workspaceSlug = c.req.header("x-blackwall-workspace-slug");
  if (!workspaceSlug) {
    throw new HTTPException(400, {
      message: "Missing required header: x-blackwall-workspace-slug",
    });
  }

  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const workspace = await workspaceService.getWorkspaceBySlug(workspaceSlug, user.id);

  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  c.set("workspace", workspace);

  await next();
});
