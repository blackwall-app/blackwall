import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const boardLoader = query(async (teamKey: string) => {
  const { issues } = await runApi((client) =>
    client.issues.list({
      query: {
        teamKey,
        statusFilters: ["to_do", "in_progress", "done"],
        onlyOnActiveSprint: true,
        pagination: false,
      },
    }),
  );
  return issues;
}, "boardIssues");
