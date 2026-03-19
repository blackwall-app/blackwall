import { randomUUID } from "node:crypto";
import { E2E_DEFAULTS } from "./constants.ts";
import {
  createIssue,
  createLabel,
  createSprint,
  createUser,
  insertBaseFixtures,
  textDoc,
} from "./factories.ts";
import type { E2EManifest, E2EScenarioName } from "./types.ts";

type ScenarioBuilder = () => Promise<E2EManifest>;

function createManifest(): E2EManifest {
  return {
    workspaceSlug: E2E_DEFAULTS.workspace.slug,
    teamKey: E2E_DEFAULTS.team.key,
    users: {},
    issues: {},
    tokens: {},
  };
}

const scenarios: Record<E2EScenarioName, ScenarioBuilder> = {
  "active-sprint-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const doneIssue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Done Issue",
      status: "done",
    });

    manifest.issues.done = {
      key: doneIssue.key,
      summary: doneIssue.summary,
    };

    return manifest;
  },
  "attachments-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const issue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Attachment Test Issue",
    });

    manifest.issues.primary = {
      key: issue.key,
      summary: issue.summary,
    };

    return manifest;
  },
  "auth-base": async () => {
    const manifest = createManifest();
    await insertBaseFixtures();
    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };
    return manifest;
  },
  "backlog-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const sprint = await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Backlog Sprint",
      status: "planned",
    });

    const backlogIssueOne = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Backlog Issue One",
    });
    const backlogIssueTwo = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Backlog Issue Two",
      status: "in_progress",
    });
    const sprintIssue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Sprint Issue One",
      sprintId: sprint.id,
    });

    manifest.issues.backlogPrimary = {
      key: backlogIssueOne.key,
      summary: backlogIssueOne.summary,
    };
    manifest.issues.backlogSecondary = {
      key: backlogIssueTwo.key,
      summary: backlogIssueTwo.summary,
    };
    manifest.issues.sprintIssue = {
      key: sprintIssue.key,
      summary: sprintIssue.summary,
    };

    return manifest;
  },
  "board-active-sprint": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const sprint = await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Board Sprint",
      status: "active",
    });

    const toDo = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Board Issue To Do",
      status: "to_do",
      sprintId: sprint.id,
    });
    const inProgress = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Board Issue In Progress",
      status: "in_progress",
      sprintId: sprint.id,
    });
    const done = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Board Issue Done",
      status: "done",
      sprintId: sprint.id,
    });

    manifest.issues.toDo = { key: toDo.key, summary: toDo.summary };
    manifest.issues.inProgress = { key: inProgress.key, summary: inProgress.summary };
    manifest.issues.done = { key: done.key, summary: done.summary };

    return manifest;
  },
  "comments-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const issue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Comment Test Issue",
    });

    manifest.issues.primary = {
      key: issue.key,
      summary: issue.summary,
    };

    return manifest;
  },
  empty: async () => createManifest(),
  "invitation-base": async () => {
    const manifest = createManifest();
    const { workspace } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const secondary = await createUser({
      email: E2E_DEFAULTS.users.secondary.email,
      password: E2E_DEFAULTS.users.secondary.password,
      name: E2E_DEFAULTS.users.secondary.name,
    });
    const wrongUser = await createUser({
      email: E2E_DEFAULTS.users.wrongUser.email,
      password: E2E_DEFAULTS.users.wrongUser.password,
      name: E2E_DEFAULTS.users.wrongUser.name,
    });

    manifest.users.secondary = {
      email: secondary.email,
      password: E2E_DEFAULTS.users.secondary.password,
      name: secondary.name,
    };
    manifest.users.wrongUser = {
      email: wrongUser.email,
      password: E2E_DEFAULTS.users.wrongUser.password,
      name: wrongUser.name,
    };
    manifest.tokens.template = randomUUID();
    manifest.workspaceSlug = workspace.slug;

    return manifest;
  },
  "issue-detail-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const issue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Detail Test Issue",
    });
    const deleteIssue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Issue to Delete",
    });

    manifest.issues.primary = { key: issue.key, summary: issue.summary };
    manifest.issues.deleteCandidate = {
      key: deleteIssue.key,
      summary: deleteIssue.summary,
    };

    return manifest;
  },
  "labels-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const issue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Label Test Issue",
    });

    await createLabel({ workspaceId: workspace.id, name: "Feature", colorKey: "green" });
    await createLabel({ workspaceId: workspace.id, name: "Remove Me", colorKey: "red" });
    await createLabel({ workspaceId: workspace.id, name: "DeleteLabel", colorKey: "violet" });

    manifest.issues.primary = { key: issue.key, summary: issue.summary };

    return manifest;
  },
  "my-issues-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const other = await createUser({
      email: E2E_DEFAULTS.users.other.email,
      password: E2E_DEFAULTS.users.other.password,
      name: E2E_DEFAULTS.users.other.name,
      workspaceId: workspace.id,
      teamId: team.id,
    });

    manifest.users.other = {
      email: other.email,
      password: E2E_DEFAULTS.users.other.password,
      name: other.name,
    };

    const assignedToPrimary = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "My Assigned Issue",
      assignedToId: user.id,
    });
    const assignedToOther = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Others Assigned Issue",
      assignedToId: other.id,
    });
    const unassigned = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Unassigned Issue",
    });

    manifest.issues.assignedToPrimary = {
      key: assignedToPrimary.key,
      summary: assignedToPrimary.summary,
    };
    manifest.issues.assignedToOther = {
      key: assignedToOther.key,
      summary: assignedToOther.summary,
    };
    manifest.issues.unassigned = {
      key: unassigned.key,
      summary: unassigned.summary,
    };

    return manifest;
  },
  "search-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const issue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "playwright-unique-title-xyz",
      description: textDoc("searchable-keyword-abc unique content"),
    });

    manifest.issues.primary = {
      key: issue.key,
      summary: issue.summary,
    };

    return manifest;
  },
  "sprints-lifecycle-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "View Sprint",
      goal: "See it",
      status: "planned",
    });
    await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Edit Me Sprint",
      status: "planned",
    });
    const completeSprint = await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Complete Me Sprint",
      status: "active",
    });
    await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Start Me Sprint",
      status: "planned",
    });
    await createSprint({
      teamId: team.id,
      createdById: user.id,
      name: "Archive Me Sprint",
      status: "planned",
    });

    const doneIssue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Done Issue",
      status: "done",
      sprintId: completeSprint.id,
    });
    const leftoverIssue = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Leftover Issue",
      status: "to_do",
      sprintId: completeSprint.id,
    });

    manifest.issues.done = { key: doneIssue.key, summary: doneIssue.summary };
    manifest.issues.leftover = { key: leftoverIssue.key, summary: leftoverIssue.summary };

    return manifest;
  },
  "time-entries-basic": async () => {
    const manifest = createManifest();
    const { workspace, team, user } = await insertBaseFixtures();

    manifest.users.primary = { ...E2E_DEFAULTS.users.primary };

    const singleLog = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Time Entry Test Issue: single log",
    });
    const multipleLogs = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Time Entry Test Issue: multiple logs",
    });
    const deleteLog = await createIssue({
      workspaceId: workspace.id,
      teamId: team.id,
      createdById: user.id,
      summary: "Time Entry Test Issue: delete log",
    });

    manifest.issues.singleLog = { key: singleLog.key, summary: singleLog.summary };
    manifest.issues.multipleLogs = { key: multipleLogs.key, summary: multipleLogs.summary };
    manifest.issues.deleteLog = { key: deleteLog.key, summary: deleteLog.summary };

    return manifest;
  },
};

export async function seedE2EScenario(scenario: E2EScenarioName): Promise<E2EManifest> {
  return scenarios[scenario]();
}
