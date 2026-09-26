import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization } from "./auth";
import { NotWorkspaceMember, WorkspaceNotFound, WorkspaceSlugTaken } from "./effect-errors";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  WorkspaceIdParamsSchema,
  WorkspaceListResponse,
  WorkspaceResponse,
  WorkspaceSlugParamsSchema,
} from "./workspaces";

export class WorkspacesApi extends HttpApiGroup.make("workspaces")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: WorkspaceListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateWorkspaceSchema,
      success: WorkspaceResponse,
      error: WorkspaceSlugTaken,
    }),
  )
  .add(
    HttpApiEndpoint.get("getBySlug", "/:slug", {
      params: WorkspaceSlugParamsSchema,
      success: WorkspaceResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/:workspaceId", {
      params: WorkspaceIdParamsSchema,
      payload: UpdateWorkspaceSchema,
      success: WorkspaceResponse,
      error: [WorkspaceNotFound, NotWorkspaceMember],
    }),
  )
  .middleware(Authorization)
  .prefix("/workspaces") {}

export class Api extends HttpApi.make("blackwall-api").add(WorkspacesApi) {}
