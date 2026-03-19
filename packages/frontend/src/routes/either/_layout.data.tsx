import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { query } from "@solidjs/router";

export const eitherLoader = query(async () => {
  const session = await authClient.getSession();

  if (!session.data) {
    return {
      sessionData: null,
      preferredWorkspace: null,
    };
  }

  const preferredWorkspaceRes = await api.api.workspaces.preferred.$get();
  const preferredWorkspace = await preferredWorkspaceRes.json();

  return {
    sessionData: session.data,
    preferredWorkspace: preferredWorkspace.workspace ?? null,
  };
}, "eitherLoader");
