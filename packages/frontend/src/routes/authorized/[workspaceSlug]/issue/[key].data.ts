import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { query } from "@solidjs/router";

export const issueLoader = query(async (issueKey: string, workspaceSlug: string) => {
  const teamKey = issueKey.split("-")[0];
  if (!teamKey) {
    throw new Error(m.loader_invalid_issue_key());
  }

  const [issueRes, membersRes, sprintsRes] = await Promise.all([
    api.api.issues[":issueKey"].$get({
      param: { issueKey },
    }),
    api.api.workspaces[":slug"].members.$get({
      param: { slug: workspaceSlug },
    }),
    teamKey
      ? api.api["issue-sprints"].teams[":teamKey"].sprints.$get({
          param: { teamKey },
        })
      : null,
  ]);

  const { issue } = await issueRes.json();
  const { members } = await membersRes.json();
  const sprints = sprintsRes ? (await sprintsRes.json()).sprints : [];
  const openSprints = sprints.filter((sprint) => sprint.status !== "completed");

  return {
    issue,
    labels: issue.labels ?? [],
    assignableUsers: members,
    openSprints,
  };
}, "issueShow");
