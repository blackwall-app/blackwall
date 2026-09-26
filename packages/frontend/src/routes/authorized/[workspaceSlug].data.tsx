import { api } from "@/lib/api";
import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const workspaceLoader = query(async (workspaceSlug: string) => {
  window.__workspaceSlug = workspaceSlug;
  const { workspace } = await runApi((client) =>
    client.workspaces.getBySlug({ params: { slug: workspaceSlug } }),
  );

  const teamsRes = await api.api.teams.$get();
  const { teams } = await teamsRes.json();

  return { workspace, teams };
}, "workspaceLayout");
