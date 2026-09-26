import { HttpApi } from "effect/unstable/httpapi";
import { RequestValidation } from "./errors";
import { WorkspacesApi } from "./workspaces";

// `middleware` only applies to endpoints that already exist, so add new groups
// above `RequestValidation`.
export class Api extends HttpApi.make("blackwall-api")
  .add(WorkspacesApi)
  .middleware(RequestValidation) {}
