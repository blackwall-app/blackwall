import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const allIssuesLoader = query(async (teamKey: string) => {
  const res = await api.api.issues.$get({
    query: {
      teamKey,
    },
  });

  const { issues } = await res.json();
  return issues;
}, "allIssues");
