import {
  Api,
  CurrentUser,
  CurrentWorkspace,
  NotMemberOfThisTeam,
  TeamNotFoundOrNotMember,
  ValidationError,
} from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { TeamService } from "../features/teams/TeamService";

export const TeamsHandlers = HttpApiBuilder.group(
  Api,
  "teams",
  Effect.fn(function* (handlers) {
    const teams = yield* TeamService;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          // Membership was only checked for the header's workspace.
          if (payload.workspaceId !== workspace.id) {
            return yield* new ValidationError({
              message: "workspaceId must match the x-blackwall-workspace-slug workspace",
            });
          }
          const team = yield* teams.createTeam(payload);
          return { team };
        }),
      list: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          return {
            teams: yield* teams.listTeamsForUser({ workspaceId: workspace.id, userId: user.id }),
          };
        }),
      preferred: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          return {
            team: yield* teams.getPreferredTeamForUser({ workspaceId: workspace.id, user }),
          };
        }),
      listWithActiveSprints: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          return {
            teams: yield* teams.listTeamsWithActiveSprintForUser({
              workspaceId: workspace.id,
              userId: user.id,
            }),
          };
        }),
      getByKey: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const team = yield* teams
            .requireTeamForUser({
              workspaceId: workspace.id,
              teamKey: params.teamKey,
              userId: user.id,
            })
            .pipe(
              Effect.catchTag("TeamNotFoundOrAccessDenied", () =>
                Effect.fail(new TeamNotFoundOrNotMember()),
              ),
            );
          return { team };
        }),
      listUsers: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const users = yield* teams
            .listTeamUsers({
              workspaceId: workspace.id,
              teamKey: params.teamKey,
              userId: user.id,
            })
            .pipe(
              Effect.catchTag("TeamNotFoundOrAccessDenied", () =>
                Effect.fail(new NotMemberOfThisTeam()),
              ),
            );
          return { users };
        }),
    });
  }),
);
