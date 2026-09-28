import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const backlogLoader = query(async (teamKey: string, includeDone: boolean) => {
  const { issues } = await runApi((client) =>
    client.issues.list({
      query: {
        teamKey,
        withoutSprint: true,
        ...(includeDone ? {} : { statusFilters: ["to_do", "in_progress"] }),
      },
    }),
  );
  return issues;
}, "backlogIssues");
