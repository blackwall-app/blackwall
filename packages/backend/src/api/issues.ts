import { Api, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { IssueService } from "../features/issues/IssueService";
import { LabelService } from "../features/issues/LabelService";

export const IssuesHandlers = HttpApiBuilder.group(
  Api,
  "issues",
  Effect.fn(function* (handlers) {
    const issues = yield* IssueService;
    const labels = yield* LabelService;

    const context = Effect.gen(function* () {
      const user = yield* CurrentUser;
      const workspace = yield* CurrentWorkspace;
      return { userId: user.id, workspaceId: workspace.id };
    });

    return handlers.handleAll({
      list: ({ query }) =>
        Effect.gen(function* () {
          return yield* issues.listIssuesForTeam({ ...(yield* context), ...query });
        }),
      create: ({ payload }) =>
        Effect.gen(function* () {
          const issue = yield* issues.createIssue({
            ...(yield* context),
            teamKey: payload.teamKey,
            issue: payload.issue,
          });
          return { issue };
        }),
      my: ({ query }) =>
        Effect.gen(function* () {
          return yield* issues.listIssuesAssignedToUser({
            ...(yield* context),
            cursor: query.cursor,
          });
        }),
      get: ({ params }) =>
        Effect.gen(function* () {
          const issue = yield* issues.requireIssueForUser({
            ...(yield* context),
            issueKey: params.issueKey,
          });
          return { issue };
        }),
      bulkUpdate: ({ payload }) =>
        Effect.gen(function* () {
          const updated = yield* issues.updateIssuesBulk({ ...(yield* context), ...payload });
          return { issues: updated };
        }),
      move: ({ payload }) =>
        Effect.gen(function* () {
          yield* issues.moveIssue({
            ...(yield* context),
            issueKey: payload.issueKey,
            status: payload.status,
            previousIssueKey: payload.previousIssueKey ?? null,
            nextIssueKey: payload.nextIssueKey ?? null,
          });
          return { success: true };
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* () {
          const issue = yield* issues.updateIssue({
            ...(yield* context),
            issueKey: params.issueKey,
            updates: payload,
          });
          return { issue };
        }),
      bulkDelete: ({ payload }) =>
        Effect.gen(function* () {
          const deleted = yield* issues.deleteIssuesBulk({ ...(yield* context), ...payload });
          return { message: `${deleted.length} issues deleted` };
        }),
      delete: ({ params }) =>
        Effect.gen(function* () {
          yield* issues.deleteIssue({ ...(yield* context), issueKey: params.issueKey });
          return { message: "Issue deleted" };
        }),
      addLabel: ({ params, payload }) =>
        Effect.gen(function* () {
          const { userId, workspaceId } = yield* context;
          const issue = yield* issues.requireIssueForUser({
            workspaceId,
            userId,
            issueKey: params.issueKey,
          });
          yield* labels.addLabelToIssue({
            workspaceId,
            issueId: issue.id,
            labelId: payload.labelId,
            actorId: userId,
          });
          return { success: true };
        }),
      removeLabel: ({ params }) =>
        Effect.gen(function* () {
          const { userId, workspaceId } = yield* context;
          const issue = yield* issues.requireIssueForUser({
            workspaceId,
            userId,
            issueKey: params.issueKey,
          });
          yield* labels.removeLabelFromIssue({
            workspaceId,
            issueId: issue.id,
            labelId: params.labelId,
            actorId: userId,
          });
          return { success: true };
        }),
    });
  }),
);
