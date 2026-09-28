import { runApi } from "@/lib/api-effect";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const issueLoader = query(async (issueKey: string, workspaceSlug: string) => {
  const teamKey = issueKey.split("-")[0];
  if (!teamKey) {
    throw new Error(m.loader_invalid_issue_key());
  }

  const [{ issue }, { members }, { sprints }] = await Promise.all([
    runApi((client) => client.issues.get({ params: { issueKey } })),
    runApi((client) => client.workspaces.listMembers({ params: { slug: workspaceSlug } })),
    runApi((client) => client.sprints.list({ params: { teamKey } })),
  ]);

  const openSprints = sprints.filter((sprint) => sprint.status !== "completed");

  return {
    issue,
    labels: issue.labels,
    assignableUsers: members,
    openSprints,
  };
}, "issueShow");
