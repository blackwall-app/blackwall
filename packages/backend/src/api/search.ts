import { Api, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { GlobalSearchService } from "../features/global-search/GlobalSearchService";

export const SearchHandlers = HttpApiBuilder.group(
  Api,
  "search",
  Effect.fn(function* (handlers) {
    const globalSearch = yield* GlobalSearchService;

    return handlers.handleAll({
      search: ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          return yield* globalSearch.search({
            searchTerm: query.q,
            workspaceId: workspace.id,
            userId: user.id,
          });
        }),
    });
  }),
);
