import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const issuesLoader = query(
  (teamKey: string, includeDone: boolean) =>
    runApi((client) =>
      client.issues.list({
        query: {
          teamKey,
          ...(includeDone ? {} : { statusFilters: ["to_do", "in_progress"] }),
        },
      }),
    ),
  "issues",
);
