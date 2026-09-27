import { Api, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { LabelService } from "../features/issues/LabelService";

export const LabelsHandlers = HttpApiBuilder.group(
  Api,
  "labels",
  Effect.fn(function* (handlers) {
    const labels = yield* LabelService;

    return handlers.handleAll({
      list: () =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          return { labels: yield* labels.listLabels({ workspaceId: workspace.id }) };
        }),
      get: ({ params }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const label = yield* labels.requireLabel({
            workspaceId: workspace.id,
            labelId: params.labelId,
          });
          return { label };
        }),
      create: ({ payload }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const label = yield* labels.createLabel({
            workspaceId: workspace.id,
            name: payload.name,
          });
          return { label };
        }),
      delete: ({ params }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          yield* labels.deleteLabel({ workspaceId: workspace.id, labelId: params.labelId });
          return { success: true };
        }),
    });
  }),
);
