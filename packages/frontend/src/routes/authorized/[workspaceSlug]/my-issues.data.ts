import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const myIssuesLoader = query(async (_args: { workspaceSlug: string }) => {
  const res = await api.api.issues.my.$get({ query: {} });
  return res.json();
}, "myIssues");
