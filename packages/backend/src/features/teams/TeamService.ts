import { Database } from "@blackwall/database/effect";
import type { Team, User } from "@blackwall/database/schema";
import { TeamKeyAlreadyExists, TeamNotFoundOrAccessDenied } from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { teamData } from "./team.data";

type TeamWithActiveSprint = NonNullable<Awaited<ReturnType<typeof teamData.getTeamForUser>>>;

export class TeamService extends Context.Service<
  TeamService,
  {
    /** The team with this key, if the user belongs to it. */
    readonly requireTeamForUser: (input: {
      workspaceId: string;
      teamKey: string;
      userId: string;
    }) => Effect.Effect<TeamWithActiveSprint, TeamNotFoundOrAccessDenied>;
    /**
     * Creates a team and takes over any alias with its key. Doesn't check
     * permissions or add anyone to the team.
     */
    readonly createTeam: (input: {
      workspaceId: string;
      name: string;
      key: string;
    }) => Effect.Effect<Team, TeamKeyAlreadyExists>;
    /** The teams in the workspace the user belongs to. */
    readonly listTeamsForUser: (input: {
      workspaceId: string;
      userId: string;
    }) => Effect.Effect<Array<TeamWithActiveSprint>>;
    /** Like `listTeamsForUser`, limited to teams running a sprint. */
    readonly listTeamsWithActiveSprintForUser: (input: {
      workspaceId: string;
      userId: string;
    }) => Effect.Effect<Array<TeamWithActiveSprint>>;
    /**
     * The user's last visited team if they still belong to it, otherwise their
     * first team in the workspace.
     */
    readonly getPreferredTeamForUser: (input: {
      workspaceId: string;
      user: Pick<User, "id" | "lastTeamId">;
    }) => Effect.Effect<TeamWithActiveSprint | null>;
    /** The members of a team. Only its own members can list them. */
    readonly listTeamUsers: (input: {
      workspaceId: string;
      teamKey: string;
      userId: string;
    }) => Effect.Effect<Array<User>, TeamNotFoundOrAccessDenied>;
  }
>()("blackwall/TeamService") {
  static readonly layer = Layer.effect(
    TeamService,
    Effect.gen(function* () {
      const database = yield* Database;

      const requireTeamForUser = Effect.fn("TeamService.requireTeamForUser")(
        function* (input: { workspaceId: string; teamKey: string; userId: string }) {
          const team = yield* database.use((db) => teamData.getTeamForUser(input, db));
          if (team === undefined) {
            return yield* new TeamNotFoundOrAccessDenied();
          }
          return team;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const createTeam = Effect.fn("TeamService.createTeam")(function* (input: {
        workspaceId: string;
        name: string;
        key: string;
      }) {
        return yield* database
          .transaction((tx) => teamData.insertTeam(tx, input))
          .pipe(
            Effect.catchTag("DatabaseError", (error) =>
              error.isUniqueViolation ? Effect.fail(new TeamKeyAlreadyExists()) : Effect.die(error),
            ),
          );
      });

      const listTeamsForUser = Effect.fn("TeamService.listTeamsForUser")(function* (input: {
        workspaceId: string;
        userId: string;
      }) {
        return yield* database.use((db) => teamData.listUserTeams(input, db));
      }, Effect.orDie);

      const listTeamsWithActiveSprintForUser = Effect.fn(
        "TeamService.listTeamsWithActiveSprintForUser",
      )(function* (input: { workspaceId: string; userId: string }) {
        return yield* database.use((db) => teamData.listUserTeamsWithActiveSprint(input, db));
      }, Effect.orDie);

      const getPreferredTeamForUser = Effect.fn("TeamService.getPreferredTeamForUser")(
        function* (input: { workspaceId: string; user: Pick<User, "id" | "lastTeamId"> }) {
          const teams = yield* listTeamsForUser({
            workspaceId: input.workspaceId,
            userId: input.user.id,
          });
          return teams.find((team) => team.id === input.user.lastTeamId) ?? teams[0] ?? null;
        },
      );

      const listTeamUsers = Effect.fn("TeamService.listTeamUsers")(
        function* (input: { workspaceId: string; teamKey: string; userId: string }) {
          yield* requireTeamForUser(input);
          return yield* database.use((db) =>
            teamData.listTeamUsers({ workspaceId: input.workspaceId, teamKey: input.teamKey }, db),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return TeamService.of({
        requireTeamForUser,
        createTeam,
        listTeamsForUser,
        listTeamsWithActiveSprintForUser,
        getPreferredTeamForUser,
        listTeamUsers,
      });
    }),
  );
}
