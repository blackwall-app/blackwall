import { createAsync, useParams, type RouteSectionProps } from "@solidjs/router";
import { teamLoader } from "./[teamKey].data";
import { createContext, Show, useContext } from "solid-js";
import type { Accessor } from "solid-js";

type TeamData = Awaited<ReturnType<typeof teamLoader>>["team"];

const TeamDataContext = createContext<Accessor<TeamData>>();

export function useTeamData() {
  const context = useContext(TeamDataContext);
  if (!context) {
    throw new Error("useTeamData must be used within TeamLayout");
  }
  return context;
}

export default function TeamLayout(props: RouteSectionProps) {
  const params = useParams();
  const teamData = createAsync(() => teamLoader(params.teamKey!));
  const team = () => teamData()?.team;

  return (
    <Show when={team()}>
      {(data) => <TeamDataContext.Provider value={data}>{props.children}</TeamDataContext.Provider>}
    </Show>
  );
}
