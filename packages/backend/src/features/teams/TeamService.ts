import { Database, type DatabaseError } from "@blackwall/database/effect";
import type { Team, User } from "@blackwall/database/schema";
import {
  MemberNotFound,
  NotTeamMember,
  TeamKeyAlreadyExists,
  TeamNotFound,
  TeamNotFoundOrAccessDenied,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { workspaceData } from "../workspaces/workspace.data";
import { teamData } from "./team.data";

type TeamWithActiveSprint = NonNullable<Awaited<ReturnType<typeof teamData.getTeamForUser>>>;
type TeamWithCounts = Awaited<ReturnType<typeof teamData.listTeamsWithCounts>>[number];

const mapTeamKeyConflict = <A>(effect: Effect.Effect<A, DatabaseError>) =>
  effect.pipe(
    Effect.catchTag("DatabaseError", (error) =>
      error.isUniqueViolation ? Effect.fail(new TeamKeyAlreadyExists()) : Effect.die(error),
    ),
  );

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
    /** Every team in the workspace, whether or not the user belongs to it. */
    readonly listTeamsWithCounts: (input: {
      workspaceId: string;
    }) => Effect.Effect<Array<TeamWithCounts>>;
    /** The team with this key. Any workspace member can read it. */
    readonly requireTeam: (input: {
      workspaceId: string;
      teamKey: string;
    }) => Effect.Effect<Team, TeamNotFound>;
    /** Like `createTeam`, and adds the user to the new team in the same transaction. */
    readonly createTeamWithMember: (input: {
      workspaceId: string;
      name: string;
      key: string;
      userId: string;
    }) => Effect.Effect<Team, TeamKeyAlreadyExists>;
    /** Renames a team. The old key keeps resolving through an alias. */
    readonly updateTeam: (input: {
      workspaceId: string;
      teamKey: string;
      name?: string | undefined;
      key?: string | undefined;
    }) => Effect.Effect<Team, TeamNotFound | TeamKeyAlreadyExists>;
    readonly getTeamWithMembers: (input: {
      workspaceId: string;
      teamKey: string;
    }) => Effect.Effect<{ team: Team; members: Array<User> }, TeamNotFound>;
    /** Workspace members who aren't in the team yet. */
    readonly listAvailableUsers: (input: {
      workspaceId: string;
      teamKey: string;
    }) => Effect.Effect<Array<User>, TeamNotFound>;
    /**
     * Adds a workspace member to a team. Only the team's own members can add
     * people. Adding an existing member does nothing.
     */
    readonly addMember: (input: {
      workspaceId: string;
      teamKey: string;
      actorId: string;
      userId: string;
    }) => Effect.Effect<void, TeamNotFound | NotTeamMember | MemberNotFound>;
    /** Only the team's own members can remove people. */
    readonly removeMember: (input: {
      workspaceId: string;
      teamKey: string;
      actorId: string;
      userId: string;
    }) => Effect.Effect<void, TeamNotFound | NotTeamMember>;
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
          .pipe(mapTeamKeyConflict);
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

      const listTeamsWithCounts = Effect.fn("TeamService.listTeamsWithCounts")(function* (input: {
        workspaceId: string;
      }) {
        return yield* database.use((db) => teamData.listTeamsWithCounts(input, db));
      }, Effect.orDie);

      const requireTeam = Effect.fn("TeamService.requireTeam")(
        function* (input: { workspaceId: string; teamKey: string }) {
          const team = yield* database.use((db) => teamData.getTeamByKey(input, db));
          if (team === undefined) {
            return yield* new TeamNotFound();
          }
          return team;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const createTeamWithMember = Effect.fn("TeamService.createTeamWithMember")(function* (input: {
        workspaceId: string;
        name: string;
        key: string;
        userId: string;
      }) {
        return yield* database
          .transaction((tx) => {
            const team = teamData.insertTeam(tx, {
              workspaceId: input.workspaceId,
              name: input.name,
              key: input.key,
            });
            teamData.insertTeamMember(tx, { teamId: team.id, userId: input.userId });
            return team;
          })
          .pipe(mapTeamKeyConflict);
      });

      const updateTeam = Effect.fn("TeamService.updateTeam")(function* (input: {
        workspaceId: string;
        teamKey: string;
        name?: string | undefined;
        key?: string | undefined;
      }) {
        const team = yield* requireTeam(input);
        if (input.name === undefined && input.key === undefined) {
          return team;
        }
        const updates = { name: input.name, key: input.key };
        return yield* database
          .transaction((tx) => teamData.updateTeam(tx, { team, updates }))
          .pipe(mapTeamKeyConflict);
      });

      const getTeamWithMembers = Effect.fn("TeamService.getTeamWithMembers")(
        function* (input: { workspaceId: string; teamKey: string }) {
          const team = yield* requireTeam(input);
          const members = yield* database.use((db) => teamData.listTeamUsers(input, db));
          return { team, members };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listAvailableUsers = Effect.fn("TeamService.listAvailableUsers")(
        function* (input: { workspaceId: string; teamKey: string }) {
          const team = yield* requireTeam(input);
          return yield* database.use((db) =>
            teamData.listWorkspaceUsersNotInTeam(
              { workspaceId: input.workspaceId, teamId: team.id },
              db,
            ),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const requireTeamMember = Effect.fn("TeamService.requireTeamMember")(
        function* (input: { workspaceId: string; teamKey: string; actorId: string }) {
          const team = yield* requireTeam(input);
          const isMember = yield* database.use((db) =>
            teamData.isTeamMember({ userId: input.actorId, teamId: team.id }, db),
          );
          if (!isMember) {
            return yield* new NotTeamMember();
          }
          return team;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const addMember = Effect.fn("TeamService.addMember")(
        function* (input: {
          workspaceId: string;
          teamKey: string;
          actorId: string;
          userId: string;
        }) {
          const team = yield* requireTeamMember(input);
          const inWorkspace = yield* database.use((db) =>
            workspaceData.isWorkspaceMember(
              { userId: input.userId, workspaceId: input.workspaceId },
              db,
            ),
          );
          if (!inWorkspace) {
            return yield* new MemberNotFound();
          }
          yield* database.use((db) =>
            teamData.insertTeamMember(db, { teamId: team.id, userId: input.userId }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const removeMember = Effect.fn("TeamService.removeMember")(
        function* (input: {
          workspaceId: string;
          teamKey: string;
          actorId: string;
          userId: string;
        }) {
          const team = yield* requireTeamMember(input);
          yield* database.use((db) =>
            teamData.removeUserFromTeam({ teamId: team.id, userId: input.userId }, db),
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
        listTeamsWithCounts,
        requireTeam,
        createTeamWithMember,
        updateTeam,
        getTeamWithMembers,
        listAvailableUsers,
        addMember,
        removeMember,
      });
    }),
  );
}
