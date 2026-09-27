import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const teamLoader = query(async (teamKey: string) => {
  const { team } = await runApi((client) => client.teams.getByKey({ params: { teamKey } }));

  return { team };
}, "teamLayout");
