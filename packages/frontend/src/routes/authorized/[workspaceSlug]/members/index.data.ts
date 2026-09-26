import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const membersLoader = query(async (slug: string) => {
  const { members } = await runApi((client) => client.workspaces.listMembers({ params: { slug } }));
  return members;
}, "members");
