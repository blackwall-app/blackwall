import { Database } from "@blackwall/database/effect";
import type { Issue, User } from "@blackwall/database/schema";
import { Context, Effect, Layer } from "effect";
import { globalSearchData } from "./global-search.data";

export class GlobalSearchService extends Context.Service<
  GlobalSearchService,
  {
    /**
     * Issues and users in the workspace matching the term, up to 50 of each.
     * Only returns issues from teams the user belongs to.
     */
    readonly search: (input: {
      searchTerm: string;
      workspaceId: string;
      userId: string;
    }) => Effect.Effect<{
      issues: Array<Issue & { type: "issue" }>;
      users: Array<User & { type: "user" }>;
    }>;
  }
>()("blackwall/GlobalSearchService") {
  static readonly layer = Layer.effect(
    GlobalSearchService,
    Effect.gen(function* () {
      const database = yield* Database;

      const search = Effect.fn("GlobalSearchService.search")(function* (input: {
        searchTerm: string;
        workspaceId: string;
        userId: string;
      }) {
        const [issues, users] = yield* database.use((db) =>
          Promise.all([
            globalSearchData.searchIssues(input, db),
            globalSearchData.searchUsers(input, db),
          ]),
        );
        return {
          issues: issues.map((issue) => ({ ...issue, type: "issue" as const })),
          users: users.map((user) => ({ ...user, type: "user" as const })),
        };
      }, Effect.orDie);

      return GlobalSearchService.of({ search });
    }),
  );
}
