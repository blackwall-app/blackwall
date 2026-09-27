import { Database } from "@blackwall/database/effect";
import { Layer, ManagedRuntime } from "effect";
import { Auth } from "../../features/auth/Auth";
import { CommentService } from "../../features/issues/CommentService";
import { GlobalSearchService } from "../../features/global-search/GlobalSearchService";
import { InvitationService } from "../../features/invitations/InvitationService";
import { IssueService } from "../../features/issues/IssueService";
import { LabelService } from "../../features/issues/LabelService";
import { TeamService } from "../../features/teams/TeamService";
import { TimeEntryService } from "../../features/time-entries/TimeEntryService";
import { WorkspaceService } from "../../features/workspaces/WorkspaceService";

/**
 * Every Effect service the backend runs, built once. The HttpApi handler and
 * the Hono routes that still call services share this graph through `memoMap`.
 * Add new services to `ServicesLive`. A service another service depends on
 * goes in the `provideMerge` below it.
 */
const ServicesLive = Layer.mergeAll(
  LabelService.layer,
  CommentService.layer,
  TimeEntryService.layer,
  GlobalSearchService.layer,
  InvitationService.layer,
).pipe(
  Layer.provideMerge(IssueService.layer),
  Layer.provideMerge(TeamService.layer),
  Layer.provideMerge(WorkspaceService.layer),
);

export const AppLayer = ServicesLive.pipe(
  Layer.provideMerge(Layer.mergeAll(Database.layer, Auth.layer)),
);

export type AppServices = Layer.Success<typeof AppLayer>;

export const memoMap = Layer.makeMemoMapUnsafe();

/** Runs Effect services from Hono routes. */
export const runtime = ManagedRuntime.make(AppLayer, { memoMap });
