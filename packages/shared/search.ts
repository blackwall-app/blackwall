import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { Issue, User } from "./models";

export const SearchQuerySchema = Schema.Struct({
  q: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
});

export type SearchQuery = typeof SearchQuerySchema.Type;

export const SearchIssueResult = Schema.Struct({
  ...Issue.fields,
  type: Schema.Literal("issue"),
});

export type SearchIssueResult = typeof SearchIssueResult.Type;

export const SearchUserResult = Schema.Struct({
  ...User.fields,
  type: Schema.Literal("user"),
});

export type SearchUserResult = typeof SearchUserResult.Type;

export const SearchResponse = Schema.Struct({
  issues: Schema.Array(SearchIssueResult),
  users: Schema.Array(SearchUserResult),
});

export type SearchResponse = typeof SearchResponse.Type;

export class SearchApi extends HttpApiGroup.make("search")
  .add(
    HttpApiEndpoint.get("search", "/", {
      query: SearchQuerySchema,
      success: SearchResponse,
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/search") {}
