import { runApi } from "@/lib/api-effect";
import { query } from "@solidjs/router";

export const teamSettingsLoader = query(
  (teamKey: string) => runApi((client) => client.settings.getTeam({ params: { teamKey } })),
  "teamSettings",
);

export const availableUsersLoader = query(async (teamKey: string) => {
  const { users } = await runApi((client) =>
    client.settings.listAvailableUsers({ params: { teamKey } }),
  );
  return users;
}, "availableUsers");
