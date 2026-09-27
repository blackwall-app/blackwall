import { Api, CurrentUser, CurrentWorkspace, TeamNotFound } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { SprintService } from "../features/issue-sprints/SprintService";
import { TeamService } from "../features/teams/TeamService";

export const SprintsHandlers = HttpApiBuilder.group(
  Api,
  "sprints",
  Effect.fn(function* (handlers) {
    const sprints = yield* SprintService;
    const teams = yield* TeamService;

    const requireTeam = (teamKey: string) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const workspace = yield* CurrentWorkspace;
        return yield* teams
          .requireTeamForUser({ workspaceId: workspace.id, teamKey, userId: user.id })
          .pipe(
            Effect.catchTag("TeamNotFoundOrAccessDenied", () => Effect.fail(new TeamNotFound())),
          );
      });

    return handlers.handleAll({
      list: ({ params }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          return { sprints: yield* sprints.listSprints({ teamId: team.id }) };
        }),
      active: ({ params }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          return { sprint: yield* sprints.getActiveSprint({ team }) };
        }),
      get: ({ params, query }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const team = yield* requireTeam(params.teamKey);
          return yield* sprints.getSprintWithIssues({
            workspaceId: workspace.id,
            teamId: team.id,
            sprintId: params.sprintId,
            cursor: query.cursor,
            limit: query.limit,
          });
        }),
      completeContext: ({ params }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          return yield* sprints.getCompleteContext({ sprintId: params.sprintId, teamId: team.id });
        }),
      create: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const team = yield* requireTeam(params.teamKey);
          const sprint = yield* sprints.createSprint({
            ...payload,
            teamId: team.id,
            createdById: user.id,
          });
          return { sprint };
        }),
      start: ({ params }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          return { sprint: yield* sprints.startSprint({ team, sprintId: params.sprintId }) };
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          const sprint = yield* sprints.updateSprint({
            ...payload,
            teamId: team.id,
            sprintId: params.sprintId,
          });
          return { sprint };
        }),
      complete: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const team = yield* requireTeam(params.teamKey);
          yield* sprints.completeSprint({
            team,
            sprintId: params.sprintId,
            createdById: user.id,
            completion: payload,
          });
          return { success: true };
        }),
      archive: ({ params }) =>
        Effect.gen(function* () {
          const team = yield* requireTeam(params.teamKey);
          yield* sprints.archiveSprint({ team, sprintId: params.sprintId });
          return { success: true };
        }),
    });
  }),
);
