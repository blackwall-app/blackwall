import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const teamsSettingsLoader = query(async () => {
  const res = await api.api.settings.teams.$get();

  if (!res.ok) {
    throw new Error(m.loader_teams_fetch_failed());
  }

  const { teams } = await res.json();
  return teams;
}, "teamsSettings");
