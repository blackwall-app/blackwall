import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const boardLoader = query(async (teamKey: string) => {
  const res = await api.api.issues.$get({
    query: {
      teamKey,
      statusFilters: ["to_do", "in_progress", "done"],
      onlyOnActiveSprint: "true",
      pagination: "false",
    },
  });

  const { issues } = await res.json();

  return issues;
}, "boardIssues");
