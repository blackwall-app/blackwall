import { runApi } from "@/lib/api-effect";
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

  const { workspace } = await runApi((client) => client.workspaces.preferred());

  return {
    sessionData: session.data,
    preferredWorkspace: workspace,
  };
}, "eitherLoader");
