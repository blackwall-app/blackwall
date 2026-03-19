import { api } from "@/lib/api";
import { query, redirect } from "@solidjs/router";

export const redirectToPreferredWorkspace = query(async () => {
  const res = await api.api.workspaces.preferred.$get();

  const { workspace } = await res.json();

  if (!workspace) {
    // TODO redirect to onboarding
    return;
  }

  throw redirect(`/${workspace.slug}`);
}, "redirectPreferredWorkspace");
