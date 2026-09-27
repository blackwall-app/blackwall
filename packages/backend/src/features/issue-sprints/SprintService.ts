import { Database } from "@blackwall/database/effect";
import type { IssueSprint } from "@blackwall/database/schema";
import {
  CannotArchiveActiveSprint,
  CannotCompleteArchivedSprint,
  CannotStartArchivedSprint,
  CannotStartCompletedSprint,
  CannotStartWhileSprintActive,
  CannotUpdateArchivedSprint,
  CannotUpdateCompletedSprint,
  IssueSprintNotFound,
  OnlyActiveSprintsCanBeCompleted,
  SprintAlreadyActive,
  SprintAlreadyArchived,
  SprintAlreadyCompleted,
  SprintNotCurrentlyActive,
  TargetSprintMustBePlanned,
  TargetSprintNotFound,
  type CompleteSprint,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { IssueService } from "../issues/IssueService";
import { issueSprintData } from "./issue-sprint.data";

/** The team a sprint call runs in, with the sprint it's currently running. */
type SprintTeam = { id: string; activeSprint: { id: string } | null };

type IssuePage = Effect.Success<ReturnType<IssueService["Service"]["listIssuesInSprint"]>>;

/** Sprints span whole UTC days: from the start day's first millisecond to the end day's last. */
const toSprintRange = (range: { startDate: string; endDate: string }) => ({
  startDate: new Date(`${range.startDate}T00:00:00.000Z`),
  endDate: new Date(`${range.endDate}T23:59:59.999Z`),
});

export class SprintService extends Context.Service<
  SprintService,
  {
    /** The team's sprints that aren't archived, newest first. */
    readonly listSprints: (input: { teamId: string }) => Effect.Effect<Array<IssueSprint>>;
    readonly getActiveSprint: (input: { team: SprintTeam }) => Effect.Effect<IssueSprint | null>;
    readonly requireSprint: (input: {
      sprintId: string;
      teamId: string;
    }) => Effect.Effect<IssueSprint, IssueSprintNotFound>;
    readonly getSprintWithIssues: (input: {
      workspaceId: string;
      teamId: string;
      sprintId: string;
      cursor?: string | undefined;
      limit?: number | undefined;
    }) => Effect.Effect<{ sprint: IssueSprint } & IssuePage, IssueSprintNotFound>;
    /** What the complete form needs: the other planned sprints and whether work is left. */
    readonly getCompleteContext: (input: { sprintId: string; teamId: string }) => Effect.Effect<
      {
        sprint: IssueSprint;
        plannedSprints: Array<IssueSprint>;
        hasUndoneIssues: boolean;
      },
      IssueSprintNotFound
    >;
    /** Creates a planned sprint. Dates are `YYYY-MM-DD` days. */
    readonly createSprint: (input: {
      teamId: string;
      createdById: string;
      name: string;
      goal: string | null;
      startDate: string;
      endDate: string;
    }) => Effect.Effect<IssueSprint>;
    /** Starts a planned sprint. A team runs at most one sprint at a time. */
    readonly startSprint: (input: {
      team: SprintTeam;
      sprintId: string;
    }) => Effect.Effect<
      IssueSprint,
      | IssueSprintNotFound
      | CannotStartArchivedSprint
      | CannotStartCompletedSprint
      | SprintAlreadyActive
      | CannotStartWhileSprintActive
    >;
    readonly updateSprint: (input: {
      teamId: string;
      sprintId: string;
      name: string;
      goal: string | null;
      startDate: string;
      endDate: string;
    }) => Effect.Effect<
      IssueSprint,
      IssueSprintNotFound | CannotUpdateArchivedSprint | CannotUpdateCompletedSprint
    >;
    /**
     * Completes the team's active sprint. Done issues stay in it; the rest move
     * to the backlog, a planned sprint, or a new one, as `completion` says.
     */
    readonly completeSprint: (input: {
      team: SprintTeam;
      sprintId: string;
      createdById: string;
      completion: CompleteSprint;
    }) => Effect.Effect<
      void,
      | IssueSprintNotFound
      | CannotCompleteArchivedSprint
      | SprintAlreadyCompleted
      | OnlyActiveSprintsCanBeCompleted
      | SprintNotCurrentlyActive
      | TargetSprintNotFound
      | TargetSprintMustBePlanned
    >;
    /** Archives a sprint that isn't running and moves its unfinished issues to the backlog. */
    readonly archiveSprint: (input: {
      team: SprintTeam;
      sprintId: string;
    }) => Effect.Effect<
      void,
      IssueSprintNotFound | SprintAlreadyArchived | CannotArchiveActiveSprint
    >;
  }
>()("blackwall/SprintService") {
  static readonly layer = Layer.effect(
    SprintService,
    Effect.gen(function* () {
      const database = yield* Database;
      const issues = yield* IssueService;

      const listSprints = Effect.fn("SprintService.listSprints")(function* (input: {
        teamId: string;
      }) {
        return yield* database.use((db) => issueSprintData.listSprintsForTeam(input, db));
      }, Effect.orDie);

      const getActiveSprint = Effect.fn("SprintService.getActiveSprint")(function* (input: {
        team: SprintTeam;
      }) {
        const activeSprintId = input.team.activeSprint?.id;
        if (activeSprintId === undefined) {
          return null;
        }
        const sprint = yield* database.use((db) =>
          issueSprintData.getSprintById({ sprintId: activeSprintId, teamId: input.team.id }, db),
        );
        return sprint?.status === "active" ? sprint : null;
      }, Effect.orDie);

      const requireSprint = Effect.fn("SprintService.requireSprint")(
        function* (input: { sprintId: string; teamId: string }) {
          const sprint = yield* database.use((db) => issueSprintData.getSprintById(input, db));
          if (sprint === undefined) {
            return yield* new IssueSprintNotFound();
          }
          return sprint;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getSprintWithIssues = Effect.fn("SprintService.getSprintWithIssues")(function* (input: {
        workspaceId: string;
        teamId: string;
        sprintId: string;
        cursor?: string | undefined;
        limit?: number | undefined;
      }) {
        const sprint = yield* requireSprint(input);
        const page = yield* issues.listIssuesInSprint(input);
        return { sprint, ...page };
      });

      const getCompleteContext = Effect.fn("SprintService.getCompleteContext")(
        function* (input: { sprintId: string; teamId: string }) {
          const sprint = yield* requireSprint(input);
          const [plannedSprints, undoneIssues] = yield* Effect.all(
            [
              database.use((db) =>
                issueSprintData.listPlannedSprintsForTeam({ teamId: input.teamId }, db),
              ),
              database.use((db) =>
                issueSprintData.countUndoneIssuesInSprint({ sprintId: input.sprintId }, db),
              ),
            ],
            { concurrency: "unbounded" },
          );
          return {
            sprint,
            plannedSprints: plannedSprints.filter((planned) => planned.id !== input.sprintId),
            hasUndoneIssues: undoneIssues > 0,
          };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const createSprint = Effect.fn("SprintService.createSprint")(function* (input: {
        teamId: string;
        createdById: string;
        name: string;
        goal: string | null;
        startDate: string;
        endDate: string;
      }) {
        return yield* database.transaction((tx) =>
          issueSprintData.insertSprint(tx, {
            teamId: input.teamId,
            createdById: input.createdById,
            name: input.name,
            goal: input.goal,
            ...toSprintRange(input),
          }),
        );
      }, Effect.orDie);

      const startSprint = Effect.fn("SprintService.startSprint")(function* (input: {
        team: SprintTeam;
        sprintId: string;
      }) {
        const sprint = yield* requireSprint({ sprintId: input.sprintId, teamId: input.team.id });
        if (sprint.archivedAt !== null) {
          return yield* new CannotStartArchivedSprint();
        }
        if (sprint.status === "completed") {
          return yield* new CannotStartCompletedSprint();
        }
        if (sprint.status === "active") {
          return yield* new SprintAlreadyActive();
        }
        if (input.team.activeSprint !== null) {
          return yield* new CannotStartWhileSprintActive();
        }
        return yield* database
          .transaction((tx) =>
            issueSprintData.setSprintStatus(tx, { sprintId: sprint.id, status: "active" }),
          )
          .pipe(
            // A concurrent request started another sprint first; the one-active-per-team index rejected this one.
            Effect.catchTag("DatabaseError", (error) =>
              error.isUniqueViolation
                ? Effect.fail(new CannotStartWhileSprintActive())
                : Effect.die(error),
            ),
          );
      });

      const updateSprint = Effect.fn("SprintService.updateSprint")(
        function* (input: {
          teamId: string;
          sprintId: string;
          name: string;
          goal: string | null;
          startDate: string;
          endDate: string;
        }) {
          const sprint = yield* requireSprint(input);
          if (sprint.archivedAt !== null) {
            return yield* new CannotUpdateArchivedSprint();
          }
          if (sprint.status === "completed") {
            return yield* new CannotUpdateCompletedSprint();
          }
          return yield* database.transaction((tx) =>
            issueSprintData.updateSprint(tx, {
              sprintId: sprint.id,
              name: input.name,
              goal: input.goal,
              ...toSprintRange(input),
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const completeSprint = Effect.fn("SprintService.completeSprint")(
        function* (input: {
          team: SprintTeam;
          sprintId: string;
          createdById: string;
          completion: CompleteSprint;
        }) {
          const sprint = yield* requireSprint({ sprintId: input.sprintId, teamId: input.team.id });
          if (sprint.archivedAt !== null) {
            return yield* new CannotCompleteArchivedSprint();
          }
          if (sprint.status === "completed") {
            return yield* new SprintAlreadyCompleted();
          }
          if (sprint.status !== "active") {
            return yield* new OnlyActiveSprintsCanBeCompleted();
          }
          if (input.team.activeSprint?.id !== sprint.id) {
            return yield* new SprintNotCurrentlyActive();
          }

          const { completion } = input;
          if (completion.onUndoneIssues === "moveToPlannedSprint") {
            const target = yield* requireSprint({
              sprintId: completion.targetSprintId,
              teamId: input.team.id,
            }).pipe(
              Effect.catchTag("IssueSprintNotFound", () => Effect.fail(new TargetSprintNotFound())),
            );
            if (target.status !== "planned") {
              return yield* new TargetSprintMustBePlanned();
            }
          }

          yield* database.transaction((tx) => {
            let toSprintId: string | null = null;
            if (completion.onUndoneIssues === "moveToPlannedSprint") {
              toSprintId = completion.targetSprintId;
            } else if (completion.onUndoneIssues === "moveToNewSprint") {
              toSprintId = issueSprintData.insertSprint(tx, {
                teamId: input.team.id,
                createdById: input.createdById,
                name: completion.newSprint.name,
                goal: null,
                ...toSprintRange(completion.newSprint),
              }).id;
            }
            issueSprintData.moveUndoneIssues(tx, { fromSprintId: sprint.id, toSprintId });
            issueSprintData.completeSprint(tx, { sprintId: sprint.id });
          });
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const archiveSprint = Effect.fn("SprintService.archiveSprint")(
        function* (input: { team: SprintTeam; sprintId: string }) {
          const sprint = yield* requireSprint({ sprintId: input.sprintId, teamId: input.team.id });
          if (sprint.archivedAt !== null) {
            return yield* new SprintAlreadyArchived();
          }
          if (input.team.activeSprint?.id === sprint.id || sprint.status === "active") {
            return yield* new CannotArchiveActiveSprint();
          }
          yield* database.transaction((tx) => {
            issueSprintData.moveUndoneIssues(tx, { fromSprintId: sprint.id, toSprintId: null });
            issueSprintData.archiveSprint(tx, { sprintId: sprint.id });
          });
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return SprintService.of({
        listSprints,
        getActiveSprint,
        requireSprint,
        getSprintWithIssues,
        getCompleteContext,
        createSprint,
        startSprint,
        updateSprint,
        completeSprint,
        archiveSprint,
      });
    }),
  );
}
