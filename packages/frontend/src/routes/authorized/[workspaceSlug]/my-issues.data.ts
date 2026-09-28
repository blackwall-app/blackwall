import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const myIssuesLoader = query(
  (_args: { workspaceSlug: string }) => runApi((client) => client.issues.my({ query: {} })),
  "myIssues",
);
