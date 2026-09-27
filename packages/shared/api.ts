import { HttpApi } from "effect/unstable/httpapi";
import { CommentsApi } from "./comments";
import { RequestValidation } from "./errors";
import { LabelsApi } from "./labels";
import { WorkspacesApi } from "./workspaces";

// `middleware` only applies to endpoints that already exist, so add new groups
// above `RequestValidation`.
export class Api extends HttpApi.make("blackwall-api")
  .add(WorkspacesApi)
  .add(LabelsApi)
  .add(CommentsApi)
  .middleware(RequestValidation) {}
