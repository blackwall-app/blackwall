import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const memberDetailLoader = query(async (slug: string, userId: string) => {
  const res = await api.api.workspaces[":slug"].members[":userId"].$get({
    param: {
      slug,
      userId,
    },
  });

  if (!res.ok) {
    throw new Error(m.loader_member_detail_fetch_failed());
  }

  const { member } = await res.json();
  return member;
}, "memberDetail");
