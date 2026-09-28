import { Database } from "@blackwall/database/effect";
import type { Issue, IssueStatus } from "@blackwall/database/schema";
import {
  IssueNotFound,
  IssuesNotAccessible,
  NextIssueNotInTargetColumn,
  PreviousAndNextIssuesMustBeDifferent,
  PreviousIssueNotInTargetColumn,
  TargetColumnRequiresAdjacentIssue,
  TeamNotFoundOrAccessDenied,
  UnableToDetermineIssueSortOrder,
} from "@blackwall/shared";
import { Context, Effect, Layer, Schema } from "effect";
import { TeamService } from "../teams/TeamService";
import {
  issueData,
  type CreateIssueInput,
  type ListIssuesPagination,
  type UpdateIssueInput,
} from "./issue.data";

type IssueWithDetails = NonNullable<Awaited<ReturnType<typeof issueData.getIssueByKey>>>;
type IssuePage = Awaited<ReturnType<typeof issueData.listIssuesInSprint>>;
type TeamIssuePage = {
  issues: Array<
    Awaited<ReturnType<typeof issueData.listIssuesInTeam>>["issues"][number] & {
      team: Effect.Success<ReturnType<TeamService["Service"]["requireTeamForUser"]>>;
    }
  >;
  nextCursor: string | null;
};
type AssignedIssuePage = Awaited<ReturnType<typeof issueData.listIssuesAssignedToUser>>;

/** Errors `issueData.moveIssue` throws inside its transaction. */
const MoveLaneError = Schema.Union([
  PreviousIssueNotInTargetColumn,
  NextIssueNotInTargetColumn,
  TargetColumnRequiresAdjacentIssue,
  UnableToDetermineIssueSortOrder,
]);

export class IssueService extends Context.Service<
  IssueService,
  {
    /**
     * The issue with this key in the workspace. Also resolves keys a team used
     * before a rename. Doesn't check team membership.
     */
    readonly requireIssue: (input: {
      workspaceId: string;
      issueKey: string;
    }) => Effect.Effect<IssueWithDetails, IssueNotFound>;
    /** Like `requireIssue`, and the user must belong to the issue's team. */
    readonly requireIssueForUser: (input: {
      workspaceId: string;
      issueKey: string;
      userId: string;
    }) => Effect.Effect<IssueWithDetails, IssueNotFound | TeamNotFoundOrAccessDenied>;
    /** A page of the sprint's issues, ordered by id. Doesn't check team membership. */
    readonly listIssuesInSprint: (input: {
      workspaceId: string;
      teamId: string;
      sprintId: string;
      cursor?: string | undefined;
      limit?: number | undefined;
    }) => Effect.Effect<IssuePage>;
    /**
     * A page of a team's issues, ordered by id. `onlyOnActiveSprint` limits it
     * to the active sprint when the team has one; `withoutSprint` wins over it.
     */
    readonly listIssuesForTeam: (
      input: {
        workspaceId: string;
        teamKey: string;
        userId: string;
        statusFilters?: ReadonlyArray<IssueStatus> | undefined;
        onlyOnActiveSprint?: boolean | undefined;
        withoutSprint?: boolean | undefined;
      } & ListIssuesPagination,
    ) => Effect.Effect<TeamIssuePage, TeamNotFoundOrAccessDenied>;
    /** A page of the issues assigned to the user across the workspace. */
    readonly listIssuesAssignedToUser: (
      input: { workspaceId: string; userId: string } & ListIssuesPagination,
    ) => Effect.Effect<AssignedIssuePage>;
    /** Creates an issue in one of the user's teams, with the team's next key. */
    readonly createIssue: (input: {
      workspaceId: string;
      teamKey: string;
      userId: string;
      issue: CreateIssueInput;
    }) => Effect.Effect<Issue, TeamNotFoundOrAccessDenied>;
    readonly updateIssue: (input: {
      workspaceId: string;
      issueKey: string;
      userId: string;
      updates: UpdateIssueInput;
    }) => Effect.Effect<Issue, IssueNotFound | TeamNotFoundOrAccessDenied>;
    /** Every issue must belong to one of the user's teams, or nothing changes. */
    readonly updateIssuesBulk: (input: {
      workspaceId: string;
      issueKeys: ReadonlyArray<string>;
      userId: string;
      updates: UpdateIssueInput;
    }) => Effect.Effect<Array<Issue>, IssuesNotAccessible>;
    readonly deleteIssue: (input: {
      workspaceId: string;
      issueKey: string;
      userId: string;
    }) => Effect.Effect<void, IssueNotFound | TeamNotFoundOrAccessDenied>;
    /** Every issue must belong to one of the user's teams, or nothing changes. */
    readonly deleteIssuesBulk: (input: {
      workspaceId: string;
      issueKeys: ReadonlyArray<string>;
      userId: string;
    }) => Effect.Effect<Array<Issue>, IssuesNotAccessible>;
    /**
     * Moves an issue into a status column between two neighbors of that column.
     * The user must belong to the teams of the issue and both neighbors.
     */
    readonly moveIssue: (input: {
      workspaceId: string;
      userId: string;
      issueKey: string;
      status: IssueStatus;
      previousIssueKey: string | null;
      nextIssueKey: string | null;
    }) => Effect.Effect<
      void,
      | IssueNotFound
      | IssuesNotAccessible
      | PreviousAndNextIssuesMustBeDifferent
      | typeof MoveLaneError.Type
    >;
  }
>()("blackwall/IssueService") {
  static readonly layer = Layer.effect(
    IssueService,
    Effect.gen(function* () {
      const database = yield* Database;
      const teams = yield* TeamService;

      const requireIssue = Effect.fn("IssueService.requireIssue")(
        function* (input: { workspaceId: string; issueKey: string }) {
          const issue = yield* database.use((db) => issueData.getIssueByKey(input, db));
          if (issue === undefined) {
            return yield* new IssueNotFound();
          }
          return issue;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const requireIssueForUser = Effect.fn("IssueService.requireIssueForUser")(function* (input: {
        workspaceId: string;
        issueKey: string;
        userId: string;
      }) {
        const issue = yield* requireIssue(input);
        if (issue.team === null) {
          return yield* new IssueNotFound();
        }
        yield* teams.requireTeamForUser({
          workspaceId: input.workspaceId,
          teamKey: issue.team.key,
          userId: input.userId,
        });
        return issue;
      });

      /** The issues with these keys, if they all belong to the user's teams. */
      const requireIssuesInUserTeams = Effect.fn("IssueService.requireIssuesInUserTeams")(
        function* (input: {
          workspaceId: string;
          issueKeys: ReadonlyArray<string>;
          userId: string;
        }) {
          const userTeams = yield* teams.listTeamsForUser(input);
          const userTeamIds = new Set(userTeams.map((team) => team.id));
          const issues = yield* database.use((db) => issueData.getIssuesByKeys(input, db));
          const issuesInUserTeams = issues.filter((issue) => userTeamIds.has(issue.teamId));
          if (issuesInUserTeams.length !== input.issueKeys.length) {
            return yield* new IssuesNotAccessible();
          }
          return issuesInUserTeams;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listIssuesInSprint = Effect.fn("IssueService.listIssuesInSprint")(function* (input: {
        workspaceId: string;
        teamId: string;
        sprintId: string;
        cursor?: string | undefined;
        limit?: number | undefined;
      }) {
        return yield* database.use((db) => issueData.listIssuesInSprint(input, db));
      }, Effect.orDie);

      const listIssuesForTeam = Effect.fn("IssueService.listIssuesForTeam")(
        function* (
          input: {
            workspaceId: string;
            teamKey: string;
            userId: string;
            statusFilters?: ReadonlyArray<IssueStatus> | undefined;
            onlyOnActiveSprint?: boolean | undefined;
            withoutSprint?: boolean | undefined;
          } & ListIssuesPagination,
        ) {
          const team = yield* teams.requireTeamForUser(input);
          const pagination = {
            cursor: input.cursor,
            limit: input.limit,
            pagination: input.pagination,
          };
          const activeSprint = input.withoutSprint ? null : team.activeSprint;
          const page = yield* database.use((db) =>
            input.onlyOnActiveSprint && activeSprint
              ? issueData.listIssuesInSprint(
                  {
                    workspaceId: input.workspaceId,
                    teamId: team.id,
                    sprintId: activeSprint.id,
                    statusFilters: input.statusFilters,
                    ...pagination,
                  },
                  db,
                )
              : issueData.listIssuesInTeam(
                  {
                    workspaceId: input.workspaceId,
                    teamId: team.id,
                    statusFilters: input.statusFilters,
                    withoutSprint: input.withoutSprint,
                    ...pagination,
                  },
                  db,
                ),
          );
          return {
            issues: page.issues.map((issue) => ({ ...issue, team })),
            nextCursor: page.nextCursor,
          };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listIssuesAssignedToUser = Effect.fn("IssueService.listIssuesAssignedToUser")(
        function* (input: { workspaceId: string; userId: string } & ListIssuesPagination) {
          return yield* database.use((db) => issueData.listIssuesAssignedToUser(input, db));
        },
        Effect.orDie,
      );

      const createIssue = Effect.fn("IssueService.createIssue")(
        function* (input: {
          workspaceId: string;
          teamKey: string;
          userId: string;
          issue: CreateIssueInput;
        }) {
          const team = yield* teams.requireTeamForUser(input);
          return yield* database.transaction((tx) =>
            issueData.insertIssue(tx, {
              workspaceId: input.workspaceId,
              teamId: team.id,
              teamKey: team.key,
              createdById: input.userId,
              issue: input.issue,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const updateIssue = Effect.fn("IssueService.updateIssue")(
        function* (input: {
          workspaceId: string;
          issueKey: string;
          userId: string;
          updates: UpdateIssueInput;
        }) {
          const issue = yield* requireIssueForUser(input);
          return yield* database.transaction((tx) =>
            issueData.updateIssue(tx, {
              workspaceId: input.workspaceId,
              actorId: input.userId,
              updates: input.updates,
              originalIssue: issue,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const updateIssuesBulk = Effect.fn("IssueService.updateIssuesBulk")(
        function* (input: {
          workspaceId: string;
          issueKeys: ReadonlyArray<string>;
          userId: string;
          updates: UpdateIssueInput;
        }) {
          const issues = yield* requireIssuesInUserTeams(input);
          return yield* database.transaction((tx) =>
            issueData.updateIssuesBulk(tx, {
              issues,
              workspaceId: input.workspaceId,
              actorId: input.userId,
              updates: input.updates,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const deleteIssue = Effect.fn("IssueService.deleteIssue")(
        function* (input: { workspaceId: string; issueKey: string; userId: string }) {
          const issue = yield* requireIssueForUser(input);
          yield* database.use((db) => issueData.softDeleteIssue({ issueId: issue.id }, db));
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const deleteIssuesBulk = Effect.fn("IssueService.deleteIssuesBulk")(
        function* (input: {
          workspaceId: string;
          issueKeys: ReadonlyArray<string>;
          userId: string;
        }) {
          const issues = yield* requireIssuesInUserTeams(input);
          return yield* database.transaction((tx) =>
            issueData.softDeleteIssuesBulk(tx, { issues, workspaceId: input.workspaceId }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const moveIssue = Effect.fn("IssueService.moveIssue")(function* (input: {
        workspaceId: string;
        userId: string;
        issueKey: string;
        status: IssueStatus;
        previousIssueKey: string | null;
        nextIssueKey: string | null;
      }) {
        if (input.previousIssueKey !== null && input.previousIssueKey === input.nextIssueKey) {
          return yield* new PreviousAndNextIssuesMustBeDifferent();
        }

        const optionalIssue = (issueKey: string | null) =>
          issueKey === null
            ? Effect.succeed(null)
            : requireIssue({ workspaceId: input.workspaceId, issueKey });
        const [movedIssue, previousIssue, nextIssue] = yield* Effect.all(
          [
            requireIssue(input),
            optionalIssue(input.previousIssueKey),
            optionalIssue(input.nextIssueKey),
          ],
          { concurrency: "unbounded" },
        );

        const userTeams = yield* teams.listTeamsForUser(input);
        const userTeamIds = new Set(userTeams.map((team) => team.id));
        const involved = [movedIssue, previousIssue, nextIssue].filter((issue) => issue !== null);
        if (involved.some((issue) => issue.team === null)) {
          return yield* new IssueNotFound();
        }
        if (involved.some((issue) => !userTeamIds.has(issue.teamId))) {
          return yield* new IssuesNotAccessible();
        }

        yield* database
          .transaction((tx) =>
            issueData.moveIssue(tx, {
              workspaceId: input.workspaceId,
              issueId: movedIssue.id,
              teamId: movedIssue.teamId,
              sprintId: movedIssue.sprintId,
              status: input.status,
              previousIssueId: previousIssue?.id ?? null,
              nextIssueId: nextIssue?.id ?? null,
            }),
          )
          .pipe(
            Effect.catchTag("DatabaseError", (error) =>
              Schema.is(MoveLaneError)(error.cause) ? Effect.fail(error.cause) : Effect.die(error),
            ),
          );
      });

      return IssueService.of({
        requireIssue,
        requireIssueForUser,
        listIssuesInSprint,
        listIssuesForTeam,
        listIssuesAssignedToUser,
        createIssue,
        updateIssue,
        updateIssuesBulk,
        deleteIssue,
        deleteIssuesBulk,
        moveIssue,
      });
    }),
  );
}
