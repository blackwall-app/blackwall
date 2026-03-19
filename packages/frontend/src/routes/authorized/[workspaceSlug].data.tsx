import { api } from "@/lib/api";
import { query, redirect } from "@solidjs/router";

export const workspaceLoader = query(async (workspaceSlug: string) => {
  window.__workspaceSlug = workspaceSlug;
  const result = await api.api.workspaces[":slug"].$get({
    param: {
      slug: workspaceSlug,
    },
  });

  const { workspace } = await result.json();

  if (!workspace) {
    throw redirect("/");
  }

  const teamsRes = await api.api.teams.$get();
  const { teams } = await teamsRes.json();

  return { workspace, teams };
}, "workspaceLayout");
