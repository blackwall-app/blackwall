import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const activeIssuesLoader = query(async (teamKey: string) => {
  const res = await api.api.issues.$get({
    query: {
      teamKey,
      statusFilters: ["to_do", "in_progress"],
    },
  });

  const { issues } = await res.json();
  return issues;
}, "activeIssues");
