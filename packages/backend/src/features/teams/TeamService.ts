import { Database } from "@blackwall/database/effect";
import { TeamNotFoundOrAccessDenied } from "@blackwall/shared";
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

      return TeamService.of({ requireTeamForUser });
    }),
  );
}
