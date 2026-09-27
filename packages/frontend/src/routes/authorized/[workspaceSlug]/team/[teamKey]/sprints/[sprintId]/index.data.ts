import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const sprintDetailLoader = query(
  (teamKey: string, sprintId: string) =>
    runApi((client) => client.sprints.get({ params: { teamKey, sprintId }, query: {} })),
  "sprintDetail",
);
