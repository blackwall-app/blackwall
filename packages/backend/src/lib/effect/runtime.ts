import { Database } from "@blackwall/database/effect";
import { Layer, ManagedRuntime } from "effect";
import { Auth } from "../../features/auth/Auth";
import { IssueService } from "../../features/issues/IssueService";
import { TeamService } from "../../features/teams/TeamService";
import { WorkspaceService } from "../../features/workspaces/WorkspaceService";

/**
 * Every Effect service the backend runs, built once. The HttpApi handler and
 * the Hono routes that still call services share this graph through `memoMap`.
 * Add new services to `ServicesLive`. A service another service depends on
 * goes in the `provideMerge` below it.
 */
const ServicesLive = Layer.mergeAll(WorkspaceService.layer, IssueService.layer).pipe(
  Layer.provideMerge(TeamService.layer),
);

export const AppLayer = ServicesLive.pipe(
  Layer.provideMerge(Layer.mergeAll(Database.layer, Auth.layer)),
);

export type AppServices = Layer.Success<typeof AppLayer>;

export const memoMap = Layer.makeMemoMapUnsafe();

/** Runs Effect services from Hono routes. */
export const runtime = ManagedRuntime.make(AppLayer, { memoMap });
