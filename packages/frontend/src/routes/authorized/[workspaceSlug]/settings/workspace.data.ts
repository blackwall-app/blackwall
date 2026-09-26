import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const workspaceMembersLoader = query(async (workspaceSlug: string) => {
  const { members } = await runApi((client) =>
    client.workspaces.listMembers({ params: { slug: workspaceSlug } }),
  );
  return members;
}, "workspaceMembers");
