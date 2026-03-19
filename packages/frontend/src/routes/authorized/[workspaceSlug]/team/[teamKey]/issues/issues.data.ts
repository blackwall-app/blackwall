import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const issuesLoader = query(async (teamKey: string, includeDone: boolean) => {
  const res = await api.api.issues.$get({
    query: {
      teamKey,
      ...(includeDone ? {} : { statusFilters: ["to_do", "in_progress"] }),
    },
  });

  return res.json();
}, "issues");
