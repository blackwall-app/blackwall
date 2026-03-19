import type { SerializedTeam, SerializedWorkspace } from "@blackwall/database/schema";
import { createContext, useContext, type Accessor } from "solid-js";

export type WorkspaceDataContextType = {
  workspace: SerializedWorkspace;
  teams: SerializedTeam[];
};

export const WorkspaceDataContext = createContext<Accessor<WorkspaceDataContextType>>();

export const useWorkspaceData = () => {
  const ctx = useContext(WorkspaceDataContext);

  if (!ctx) {
    throw new Error("useWorkspace called outside WorkspaceContext.");
  }

  return ctx;
};
