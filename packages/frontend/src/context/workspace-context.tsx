import type { TeamWithActiveSprint, Workspace } from "@blackwall/shared";
import { createContext, useContext, type Accessor } from "solid-js";

export type WorkspaceDataContextType = {
  workspace: Workspace;
  teams: ReadonlyArray<TeamWithActiveSprint>;
};

export const WorkspaceDataContext = createContext<Accessor<WorkspaceDataContextType>>();

export const useWorkspaceData = () => {
  const ctx = useContext(WorkspaceDataContext);

  if (!ctx) {
    throw new Error("useWorkspace called outside WorkspaceContext.");
  }

  return ctx;
};
