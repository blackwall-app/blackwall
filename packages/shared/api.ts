import { HttpApi } from "effect/unstable/httpapi";
import { AuthApi } from "./auth-api";
import { CommentsApi } from "./comments";
import { RequestValidation } from "./errors";
import { InvitationsApi } from "./invitations";
import { LabelsApi } from "./labels";
import { SearchApi } from "./search";
import { TeamsApi } from "./teams";
import { TimeEntriesApi } from "./time-entries";
import { WorkspacesApi } from "./workspaces";

// `middleware` only applies to endpoints that already exist, so add new groups
// above `RequestValidation`.
export class Api extends HttpApi.make("blackwall-api")
  .add(WorkspacesApi)
  .add(TeamsApi)
  .add(LabelsApi)
  .add(CommentsApi)
  .add(TimeEntriesApi)
  .add(SearchApi)
  .add(InvitationsApi)
  .add(AuthApi)
  .middleware(RequestValidation) {}
