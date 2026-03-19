import { api } from "@/lib/api";
import { query } from "@solidjs/router";

export const teamLoader = query(async (teamKey: string) => {
  const teamsRes = await api.api.teams[":teamKey"].$get({
    param: {
      teamKey,
    },
  });

  const { team } = await teamsRes.json();

  return { team };
}, "teamLayout");
