import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const sprintCompleteContextLoader = query(
  (teamKey: string, sprintId: string) =>
    runApi((client) => client.sprints.completeContext({ params: { teamKey, sprintId } })),
  "sprintCompleteContext",
);
