import type { IssueStatus } from "@blackwall/database/schema";
import { teamData } from "../teams/team.data";
import {
  issueData,
  type CreateIssueInput,
  type ListIssuesPagination,
  type UpdateIssueInput,
} from "./issue.data";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors";

/**
 * Get a team for user or throw an error if not found.
 * @param input workspace id, team key, and user id
 * @returns team data
 * @throws NotFoundError if team not found or access denied
 */
async function getTeamForUserOrThrow(input: {
  workspaceId: string;
  teamKey: string;
  userId: string;
}) {
  const team = await teamData.getTeamForUser(input);

  if (!team) {
    throw new NotFoundError("Team not found or access denied");
  }

  return team;
}

/**
 * Get an issue by its key. Validates user access to the team.
 * @param input workspace id, issue key, and user id
 * @returns issue data with relations
 * @throws NotFoundError if issue not found or access denied
 */
async function getIssueByKey(input: { workspaceId: string; issueKey: string; userId: string }) {
  const issue = await issueData.getIssueByKey({
    workspaceId: input.workspaceId,
    issueKey: input.issueKey,
  });

  if (!issue || !issue.team) {
    throw new NotFoundError("Issue not found");
  }

  await getTeamForUserOrThrow({
    workspaceId: input.workspaceId,
    teamKey: issue.team.key,
    userId: input.userId,
  });

  return issue;
}

/**
 * List issues for a team with optional filters.
 * @param input workspace id, team key, user id, and optional filters
 * @returns list of issues
 */
async function listIssuesForTeam(
  input: {
    workspaceId: string;
    teamKey: string;
    userId: string;
    statusFilters?: IssueStatus[];
    onlyOnActiveSprint?: boolean;
    withoutSprint?: boolean;
  } & ListIssuesPagination,
) {
  const team = await getTeamForUserOrThrow({
    workspaceId: input.workspaceId,
    teamKey: input.teamKey,
    userId: input.userId,
  });

  const pagination: ListIssuesPagination = {
    cursor: input.cursor,
    limit: input.limit,
    pagination: input.pagination,
  };

  if (input.onlyOnActiveSprint && team.activeSprintId && !input.withoutSprint) {
    const result = await issueData.listIssuesInSprint({
      workspaceId: input.workspaceId,
      teamId: team.id,
      sprintId: team.activeSprintId,
      statusFilters: input.statusFilters,
      ...pagination,
    });
    return {
      issues: result.issues.map((issue) => ({ ...issue, team })),
      nextCursor: result.nextCursor,
    };
  }

  const result = await issueData.listIssuesInTeam({
    workspaceId: input.workspaceId,
    teamId: team.id,
    statusFilters: input.statusFilters,
    withoutSprint: input.withoutSprint,
    ...pagination,
  });
  return {
    issues: result.issues.map((issue) => ({ ...issue, team })),
    nextCursor: result.nextCursor,
  };
}

/**
 * List all issues assigned to the current user.
 * @param input workspace id and user id
 * @returns list of issues assigned to the user
 */
async function listIssuesAssignedToUser(
  input: { workspaceId: string; userId: string } & ListIssuesPagination,
) {
  return issueData.listIssuesAssignedToUser({
    workspaceId: input.workspaceId,
    userId: input.userId,
    cursor: input.cursor,
    limit: input.limit,
    pagination: input.pagination,
  });
}

/**
 * Create a new issue in a team.
 * @param input workspace id, team key, user id, and issue data
 * @returns created issue
 */
async function createIssue(input: {
  workspaceId: string;
  teamKey: string;
  userId: string;
  issue: CreateIssueInput;
}) {
  const team = await getTeamForUserOrThrow({
    workspaceId: input.workspaceId,
    teamKey: input.teamKey,
    userId: input.userId,
  });

  return issueData.createIssue({
    workspaceId: input.workspaceId,
    teamId: team.id,
    teamKey: team.key,
    createdById: input.userId,
    issue: input.issue,
  });
}

/**
 * Update an existing issue.
 * @param input workspace id, issue key, user id, and updates
 * @returns updated issue
 */
async function updateIssue(input: {
  workspaceId: string;
  issueKey: string;
  userId: string;
  updates: UpdateIssueInput;
}) {
  const issue = await getIssueByKey({
    workspaceId: input.workspaceId,
    issueKey: input.issueKey,
    userId: input.userId,
  });

  return issueData.updateIssue({
    issueId: issue.id,
    workspaceId: input.workspaceId,
    actorId: input.userId,
    updates: input.updates,
    originalIssue: issue,
  });
}

/**
 * Update multiple issues at once.
 * @param input workspace id, issue ids, user id, and updates
 * @returns updated issues
 * @throws ForbiddenError if some issues are not accessible to the user
 */
async function updateIssuesBulk(input: {
  workspaceId: string;
  issueIds: string[];
  userId: string;
  updates: UpdateIssueInput;
}) {
  const userTeams = await teamData.listUserTeams({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  const userTeamIds = userTeams.map((team) => team.id);

  const issues = await issueData.getIssuesByIds({
    workspaceId: input.workspaceId,
    issueIds: input.issueIds,
  });

  const issuesInUserTeams = issues.filter((issue) => userTeamIds.includes(issue.teamId));

  if (issuesInUserTeams.length !== input.issueIds.length) {
    throw new ForbiddenError("Some issues are not accessible to the current user");
  }

  return issueData.updateIssuesBulk({
    issueIds: input.issueIds,
    workspaceId: input.workspaceId,
    actorId: input.userId,
    updates: input.updates,
  });
}

/**
 * Soft delete an issue by its key.
 * @param input workspace id, issue key, and user id
 */
async function deleteIssue(input: { workspaceId: string; issueKey: string; userId: string }) {
  const issue = await getIssueByKey({
    workspaceId: input.workspaceId,
    issueKey: input.issueKey,
    userId: input.userId,
  });

  await issueData.softDeleteIssue({ issueId: issue.id });
}

/**
 * Soft delete multiple issues at once.
 * @param input workspace id, issue ids, and user id
 * @returns deleted issues
 * @throws ForbiddenError if some issues are not accessible to the user
 */
async function softDeleteIssuesBulk(input: {
  workspaceId: string;
  issueIds: string[];
  userId: string;
}) {
  const userTeams = await teamData.listUserTeams({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  const userTeamIds = userTeams.map((team) => team.id);

  const issues = await issueData.getIssuesByIds({
    workspaceId: input.workspaceId,
    issueIds: input.issueIds,
  });

  const issuesInUserTeams = issues.filter((issue) => userTeamIds.includes(issue.teamId));

  if (issuesInUserTeams.length !== input.issueIds.length) {
    throw new ForbiddenError("Some issues are not accessible to the current user");
  }

  return issueData.softDeleteIssuesBulk({
    issueIds: input.issueIds,
    workspaceId: input.workspaceId,
    actorId: input.userId,
  });
}

/**
 * Move an issue to a status column and place it between neighbor anchors.
 * @param input workspace id, user id, issue key, target status, and optional previous/next anchors
 */
async function moveIssue(input: {
  workspaceId: string;
  userId: string;
  issueKey: string;
  status: IssueStatus;
  previousIssueKey: string | null;
  nextIssueKey: string | null;
}) {
  if (
    input.previousIssueKey &&
    input.nextIssueKey &&
    input.previousIssueKey === input.nextIssueKey
  ) {
    throw new BadRequestError("Previous and next issues must be different");
  }

  const [movedIssue, previousIssue, nextIssue] = await Promise.all([
    issueData.getIssueByKey({
      workspaceId: input.workspaceId,
      issueKey: input.issueKey,
    }),
    input.previousIssueKey
      ? issueData.getIssueByKey({
          workspaceId: input.workspaceId,
          issueKey: input.previousIssueKey,
        })
      : Promise.resolve(null),
    input.nextIssueKey
      ? issueData.getIssueByKey({
          workspaceId: input.workspaceId,
          issueKey: input.nextIssueKey,
        })
      : Promise.resolve(null),
  ]);

  const resolvedIssues = [movedIssue, previousIssue, nextIssue]
    .filter((issue, index) => {
      if (index === 0) return true;
      return issue !== null;
    })
    .map((issue) => {
      if (!issue || !issue.team) {
        throw new NotFoundError("Issue not found");
      }

      return issue;
    });

  const userTeams = await teamData.listUserTeams({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  const userTeamIds = new Set(userTeams.map((team) => team.id));

  if (resolvedIssues.some((issue) => !userTeamIds.has(issue.teamId))) {
    throw new ForbiddenError("Some issues are not accessible to the current user");
  }

  const resolvedMovedIssue = resolvedIssues[0]!;

  await issueData.moveIssue({
    workspaceId: input.workspaceId,
    issueId: resolvedMovedIssue.id,
    teamId: resolvedMovedIssue.teamId,
    sprintId: resolvedMovedIssue.sprintId ?? null,
    status: input.status,
    previousIssueId: previousIssue?.id ?? null,
    nextIssueId: nextIssue?.id ?? null,
  });
}

export const issueService = {
  getIssueByKey,
  listIssuesForTeam,
  listIssuesAssignedToUser,
  createIssue,
  updateIssue,
  deleteIssue,
  updateIssuesBulk,
  softDeleteIssuesBulk,
  moveIssue,
};
