import { Api, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { TimeEntryService } from "../features/time-entries/TimeEntryService";

const issueAccess = Effect.fnUntraced(function* (issueKey: string) {
  const user = yield* CurrentUser;
  const workspace = yield* CurrentWorkspace;
  return { workspaceId: workspace.id, issueKey, userId: user.id };
});

export const TimeEntriesHandlers = HttpApiBuilder.group(
  Api,
  "timeEntries",
  Effect.fn(function* (handlers) {
    const timeEntries = yield* TimeEntryService;

    return handlers.handleAll({
      list: ({ params }) =>
        Effect.gen(function* () {
          const access = yield* issueAccess(params.issueKey);
          return { entries: yield* timeEntries.listTimeEntries(access) };
        }),
      total: ({ params }) =>
        Effect.gen(function* () {
          const access = yield* issueAccess(params.issueKey);
          return { totalMinutes: yield* timeEntries.getTotalMinutes(access) };
        }),
      create: ({ params, payload }) =>
        Effect.gen(function* () {
          const access = yield* issueAccess(params.issueKey);
          const entry = yield* timeEntries.createTimeEntry({ ...access, ...payload });
          return { entry };
        }),
      delete: ({ params }) =>
        Effect.gen(function* () {
          const access = yield* issueAccess(params.issueKey);
          yield* timeEntries.deleteTimeEntry({ ...access, timeEntryId: params.timeEntryId });
          return { success: true };
        }),
    });
  }),
);
