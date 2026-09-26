import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const memberDetailLoader = query(async (slug: string, userId: string) => {
  const { member } = await runApi((client) =>
    client.workspaces.getMember({ params: { slug, userId } }),
  );
  return member;
}, "memberDetail");
