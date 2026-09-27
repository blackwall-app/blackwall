import { Database } from "@blackwall/database/effect";
import type { TimeEntry } from "@blackwall/database/schema";
import {
  IssueNotFound,
  TeamNotFoundOrAccessDenied,
  TimeEntryDurationMustBePositive,
  TimeEntryNotFound,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { IssueService } from "../issues/IssueService";
import { timeEntryData } from "./time-entry.data";

type TimeEntryWithUser = Awaited<ReturnType<typeof timeEntryData.listTimeEntriesForIssue>>[number];

interface IssueAccess {
  workspaceId: string;
  issueKey: string;
  userId: string;
}

type IssueAccessError = IssueNotFound | TeamNotFoundOrAccessDenied;

/** Time logged on issues. Every method requires the user to be on the issue's team. */
export class TimeEntryService extends Context.Service<
  TimeEntryService,
  {
    /** Entries that aren't deleted, newest first. */
    readonly listTimeEntries: (
      input: IssueAccess,
    ) => Effect.Effect<Array<TimeEntryWithUser>, IssueAccessError>;
    readonly getTotalMinutes: (input: IssueAccess) => Effect.Effect<number, IssueAccessError>;
    /** Logs time for the user and records a `time_logged` change event. */
    readonly createTimeEntry: (
      input: IssueAccess & { durationMinutes: number; description?: string },
    ) => Effect.Effect<TimeEntry, IssueAccessError | TimeEntryDurationMustBePositive>;
    /** Soft deletes an entry on the issue. Any member of the team can delete any entry. */
    readonly deleteTimeEntry: (
      input: IssueAccess & { timeEntryId: string },
    ) => Effect.Effect<void, IssueAccessError | TimeEntryNotFound>;
  }
>()("blackwall/TimeEntryService") {
  static readonly layer = Layer.effect(
    TimeEntryService,
    Effect.gen(function* () {
      const database = yield* Database;
      const issues = yield* IssueService;

      const listTimeEntries = Effect.fn("TimeEntryService.listTimeEntries")(
        function* (input: IssueAccess) {
          const issue = yield* issues.requireIssueForUser(input);
          return yield* database.use((db) =>
            timeEntryData.listTimeEntriesForIssue({ issueId: issue.id }, db),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getTotalMinutes = Effect.fn("TimeEntryService.getTotalMinutes")(
        function* (input: IssueAccess) {
          const issue = yield* issues.requireIssueForUser(input);
          return yield* database.use((db) =>
            timeEntryData.getTotalTimeLoggedForIssue({ issueId: issue.id }, db),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const createTimeEntry = Effect.fn("TimeEntryService.createTimeEntry")(
        function* (input: IssueAccess & { durationMinutes: number; description?: string }) {
          const issue = yield* issues.requireIssueForUser(input);
          if (input.durationMinutes <= 0) {
            return yield* new TimeEntryDurationMustBePositive();
          }
          return yield* database.transaction((tx) =>
            timeEntryData.insertTimeEntry(tx, {
              issueId: issue.id,
              workspaceId: input.workspaceId,
              userId: input.userId,
              durationMinutes: input.durationMinutes,
              description: input.description,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const deleteTimeEntry = Effect.fn("TimeEntryService.deleteTimeEntry")(
        function* (input: IssueAccess & { timeEntryId: string }) {
          const issue = yield* issues.requireIssueForUser(input);
          const entry = yield* database.use((db) =>
            timeEntryData.softDeleteTimeEntry(
              { timeEntryId: input.timeEntryId, issueId: issue.id },
              db,
            ),
          );
          if (entry === undefined) {
            return yield* new TimeEntryNotFound();
          }
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return TimeEntryService.of({
        listTimeEntries,
        getTotalMinutes,
        createTimeEntry,
        deleteTimeEntry,
      });
    }),
  );
}
