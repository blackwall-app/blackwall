import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const teamsSettingsLoader = query(async () => {
  const { teams } = await runApi((client) => client.settings.listTeams());
  return teams;
}, "teamsSettings");
