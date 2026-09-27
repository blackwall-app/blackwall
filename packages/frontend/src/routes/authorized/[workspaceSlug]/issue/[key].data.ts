import { api } from "@/lib/api";
import { runApi } from "@/lib/api-effect";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const issueLoader = query(async (issueKey: string, workspaceSlug: string) => {
  const teamKey = issueKey.split("-")[0];
  if (!teamKey) {
    throw new Error(m.loader_invalid_issue_key());
  }

  const [issueRes, { members }, { sprints }] = await Promise.all([
    api.api.issues[":issueKey"].$get({
      param: { issueKey },
    }),
    runApi((client) => client.workspaces.listMembers({ params: { slug: workspaceSlug } })),
    runApi((client) => client.sprints.list({ params: { teamKey } })),
  ]);

  const { issue } = await issueRes.json();
  const openSprints = sprints.filter((sprint) => sprint.status !== "completed");

  return {
    issue,
    labels: issue.labels ?? [],
    assignableUsers: members,
    openSprints,
  };
}, "issueShow");
