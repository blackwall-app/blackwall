import { Layer } from "effect";
import { AuthorizationLive } from "./authorization";
import { CommentsHandlers } from "./comments";
import { LabelsHandlers } from "./labels";
import { RequestValidationLive } from "./request-validation";
import { WorkspaceMembershipLive } from "./workspace-membership";
import { WorkspacesHandlers } from "./workspaces";

/** Server middleware for every `HttpApiMiddleware` the `Api` declares. */
export const MiddlewareLive = Layer.mergeAll(
  AuthorizationLive,
  WorkspaceMembershipLive,
  RequestValidationLive,
);

/**
 * Handlers for every group, with their middleware. Requires the app services,
 * so tests build it on `AppLayer` against the test database.
 */
export const HandlersLive = Layer.mergeAll(
  WorkspacesHandlers,
  LabelsHandlers,
  CommentsHandlers,
).pipe(Layer.provideMerge(MiddlewareLive));
