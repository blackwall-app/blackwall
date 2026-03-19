import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const backlogLoader = query(async (teamKey: string, includeDone: boolean) => {
  const res = await api.api.issues.$get({
    query: {
      teamKey,
      withoutSprint: "true",
      ...(includeDone ? {} : { statusFilters: ["to_do", "in_progress"] }),
    },
  });

  const { issues } = await res.json();
  return issues;
}, "backlogIssues");
