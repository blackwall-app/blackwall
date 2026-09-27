import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const workspaceLoader = query(async (workspaceSlug: string) => {
  window.__workspaceSlug = workspaceSlug;
  const { workspace } = await runApi((client) =>
    client.workspaces.getBySlug({ params: { slug: workspaceSlug } }),
  );

  const { teams } = await runApi((client) => client.teams.list());

  return { workspace, teams };
}, "workspaceLayout");
