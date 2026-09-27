import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const sprintsLoader = query(async (teamKey: string) => {
  const { sprints } = await runApi((client) => client.sprints.list({ params: { teamKey } }));
  return sprints;
}, "sprints");
