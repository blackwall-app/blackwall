import { runApi } from "@/lib/api-effect";
import { query, redirect } from "@solidjs/router";

export const redirectToPreferredWorkspace = query(async () => {
  const { workspace } = await runApi((client) => client.workspaces.preferred());

  if (!workspace) {
    // TODO redirect to onboarding
    return;
  }

  throw redirect(`/${workspace.slug}`);
}, "redirectPreferredWorkspace");
