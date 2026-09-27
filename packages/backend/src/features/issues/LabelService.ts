import { Database } from "@blackwall/database/effect";
import type { Label } from "@blackwall/database/schema";
import { createColorFromString, LabelNameAlreadyExists, LabelNotFound } from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { labelData } from "./label.data";

export class LabelService extends Context.Service<
  LabelService,
  {
    readonly listLabels: (input: { workspaceId: string }) => Effect.Effect<Array<Label>>;
    readonly requireLabel: (input: {
      workspaceId: string;
      labelId: string;
    }) => Effect.Effect<Label, LabelNotFound>;
    /** The color comes from the name, so a name always gets the same color. */
    readonly createLabel: (input: {
      workspaceId: string;
      name: string;
    }) => Effect.Effect<Label, LabelNameAlreadyExists>;
    readonly deleteLabel: (input: {
      workspaceId: string;
      labelId: string;
    }) => Effect.Effect<void, LabelNotFound>;
  }
>()("blackwall/LabelService") {
  static readonly layer = Layer.effect(
    LabelService,
    Effect.gen(function* () {
      const database = yield* Database;

      const listLabels = Effect.fn("LabelService.listLabels")(function* (input: {
        workspaceId: string;
      }) {
        return yield* database.use((db) => labelData.getLabelsForWorkspace(input, db));
      }, Effect.orDie);

      const requireLabel = Effect.fn("LabelService.requireLabel")(
        function* (input: { workspaceId: string; labelId: string }) {
          const label = yield* database.use((db) => labelData.getLabelById(input, db));
          if (label === undefined) {
            return yield* new LabelNotFound();
          }
          return label;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const createLabel = Effect.fn("LabelService.createLabel")(function* (input: {
        workspaceId: string;
        name: string;
      }) {
        return yield* database
          .use((db) =>
            labelData.insertLabel(db, {
              name: input.name,
              colorKey: createColorFromString(input.name),
              workspaceId: input.workspaceId,
            }),
          )
          .pipe(
            Effect.catchTag("DatabaseError", (error) =>
              error.isUniqueViolation
                ? Effect.fail(new LabelNameAlreadyExists())
                : Effect.die(error),
            ),
          );
      });

      const deleteLabel = Effect.fn("LabelService.deleteLabel")(
        function* (input: { workspaceId: string; labelId: string }) {
          const deleted = yield* database.use((db) => labelData.deleteLabel(input, db));
          if (!deleted) {
            return yield* new LabelNotFound();
          }
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return LabelService.of({ listLabels, requireLabel, createLabel, deleteLabel });
    }),
  );
}
