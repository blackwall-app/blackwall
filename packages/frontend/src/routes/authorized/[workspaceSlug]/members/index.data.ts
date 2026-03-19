import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const membersLoader = query(async (slug: string) => {
  const res = await api.api.workspaces[":slug"].members.$get({
    param: {
      slug,
    },
  });

  if (!res.ok) {
    throw new Error(m.loader_members_fetch_failed());
  }

  const { members } = await res.json();
  return members;
}, "members");
