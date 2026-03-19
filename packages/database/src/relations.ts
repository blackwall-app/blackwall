import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  label: {
    workspace: r.one.workspace({
      from: r.label.workspaceId,
      to: r.workspace.id,
    }),
    issues: r.many.issue({
      from: r.label.id.through(r.labelOnIssue.labelId),
      to: r.issue.id.through(r.labelOnIssue.issueId),
    }),
  },
  workspace: {
    labels: r.many.label(),
    issueChangeEvents: r.many.issueChangeEvent(),
    issueSprints: r.many.issueSprint({
      from: r.workspace.id.through(r.team.workspaceId),
      to: r.issueSprint.id.through(r.team.activeSprintId),
    }),
    teams: r.many.team({
      alias: "workspace_id_team_id_via_user",
      from: r.workspace.id.through(r.user.lastWorkspaceId),
      to: r.team.id.through(r.user.lastTeamId),
    }),
    users: r.many.user({
      alias: "user_id_workspace_id_via_workspaceUser",
    }),
    issues: r.many.issue(),
    invitedUsers: r.many.user({
      alias: "user_id_workspace_id_via_workspaceInvitation",
    }),
  },
  issue: {
    labels: r.many.label({
      from: r.issue.id.through(r.labelOnIssue.issueId),
      to: r.label.id.through(r.labelOnIssue.labelId),
    }),
    changeEvents: r.many.issueChangeEvent(),
    commentedByUsers: r.many.user({
      alias: "user_id_issue_id_via_issueComment",
    }),
    comments: r.many.issueComment(),
    timeEntries: r.many.timeEntry(),
    assignedTo: r.one.user({
      from: r.issue.assignedToId,
      to: r.user.id,
      alias: "issue_assignedToId_user_id",
    }),
    createdBy: r.one.user({
      from: r.issue.createdById,
      to: r.user.id,
      alias: "issue_createdById_user_id",
    }),
    team: r.one.team({
      from: r.issue.teamId,
      to: r.team.id,
    }),
    workspace: r.one.workspace({
      from: r.issue.workspaceId,
      to: r.workspace.id,
    }),
    issueSprint: r.one.issueSprint({
      from: r.issue.sprintId,
      to: r.issueSprint.id,
    }),
  },
  issueComment: {
    issue: r.one.issue({
      from: r.issueComment.issueId,
      to: r.issue.id,
      optional: false,
    }),
    author: r.one.user({
      from: r.issueComment.authorId,
      to: r.user.id,
      optional: false,
    }),
  },
  issueAttachment: {
    issue: r.one.issue({
      from: r.issueAttachment.issueId,
      to: r.issue.id,
      optional: false,
    }),
    createdBy: r.one.user({
      from: r.issueAttachment.createdById,
      to: r.user.id,
      optional: false,
    }),
  },
  issueChangeEvent: {
    actor: r.one.user({
      from: r.issueChangeEvent.actorId,
      to: r.user.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.issueChangeEvent.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    issue: r.one.issue({
      from: r.issueChangeEvent.issueId,
      to: r.issue.id,
      optional: false,
    }),
  },
  user: {
    issueChangeEvents: r.many.issueChangeEvent(),
    commentedIssues: r.many.issue({
      from: r.user.id.through(r.issueComment.authorId),
      to: r.issue.id.through(r.issueComment.issueId),
      alias: "user_id_issue_id_via_issueComment",
    }),
    accounts: r.many.account(),
    sessions: r.many.session(),
    teams: r.many.team({
      alias: "team_id_user_id_via_userOnTeam",
    }),
    workspaces: r.many.workspace({
      from: r.user.id.through(r.workspaceUser.userId),
      to: r.workspace.id.through(r.workspaceUser.workspaceId),
      alias: "user_id_workspace_id_via_workspaceUser",
    }),
    assignedIssues: r.many.issue({
      alias: "issue_assignedToId_user_id",
    }),
    createdIssues: r.many.issue({
      alias: "issue_createdById_user_id",
    }),
    workspacesWithPendingInvitation: r.many.workspace({
      from: r.user.id.through(r.workspaceInvitation.createdById),
      to: r.workspace.id.through(r.workspaceInvitation.workspaceId),
      alias: "user_id_workspace_id_via_workspaceInvitation",
    }),
    lastWorkspace: r.one.workspace({
      from: r.user.lastWorkspaceId,
      to: r.workspace.id,
    }),
    timeEntries: r.many.timeEntry(),
  },
  team: {
    workspaces: r.many.workspace({
      alias: "workspace_id_team_id_via_user",
    }),
    users: r.many.user({
      from: r.team.id.through(r.userTeam.teamId),
      to: r.user.id.through(r.userTeam.userId),
      alias: "team_id_user_id_via_userOnTeam",
    }),
    issues: r.many.issue(),
    activeSprint: r.one.issueSprint({
      from: r.team.activeSprintId,
      to: r.issueSprint.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  issueSprint: {
    workspaces: r.many.workspace({
      from: r.issueSprint.id.through(r.team.activeSprintId),
      to: r.workspace.id.through(r.team.workspaceId),
    }),
    issues: r.many.issue(),
  },
  workspaceInvitation: {
    workspace: r.one.workspace({
      from: r.workspaceInvitation.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },
  timeEntry: {
    issue: r.one.issue({
      from: r.timeEntry.issueId,
      to: r.issue.id,
      optional: false,
    }),
    user: r.one.user({
      from: r.timeEntry.userId,
      to: r.user.id,
      optional: false,
    }),
  },
}));
