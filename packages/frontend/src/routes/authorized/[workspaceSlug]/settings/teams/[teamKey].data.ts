import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const teamSettingsLoader = query(async (teamKey: string) => {
  const res = await api.api.settings.teams[":teamKey"].$get({
    param: { teamKey },
  });

  if (!res.ok) {
    throw new Error(m.loader_team_fetch_failed());
  }

  return res.json();
}, "teamSettings");

export const availableUsersLoader = query(async (teamKey: string) => {
  const res = await api.api.settings.teams[":teamKey"]["available-users"].$get({
    param: { teamKey },
  });

  if (!res.ok) {
    throw new Error(m.loader_available_users_fetch_failed());
  }

  const { users } = await res.json();
  return users;
}, "availableUsers");
