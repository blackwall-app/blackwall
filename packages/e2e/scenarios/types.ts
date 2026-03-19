export const e2eScenarioNames = [
  "active-sprint-basic",
  "attachments-basic",
  "auth-base",
  "backlog-basic",
  "board-active-sprint",
  "comments-basic",
  "empty",
  "invitation-base",
  "issue-detail-basic",
  "labels-basic",
  "my-issues-basic",
  "search-basic",
  "sprints-lifecycle-basic",
  "time-entries-basic",
] as const;

export type E2EScenarioName = (typeof e2eScenarioNames)[number];

export type E2EManifestUser = {
  email: string;
  password: string;
  name: string;
};

export type E2EManifestIssue = {
  key: string;
  summary: string;
};

export type E2EManifest = {
  workspaceSlug: string;
  teamKey: string;
  users: Record<string, E2EManifestUser>;
  issues: Record<string, E2EManifestIssue>;
  tokens: Record<string, string>;
};
