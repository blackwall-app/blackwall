import { ErrorCode } from "@blackwall/shared";
import { issueSprintData } from "./issue-sprint.data";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import type { CompleteIssueSprint } from "./issue-sprint.zod";

/**
 * List all sprints for a team.
 * @param input team id
 * @returns list of issue sprints
 */
async function listSprints(input: { teamId: string }) {
  return issueSprintData.listSprintsForTeam({ teamId: input.teamId });
}

/**
 * Get a sprint by its id.
 * @param input sprint id and team id
 * @returns issue sprint
 * @throws NotFoundError if sprint not found
 */
async function getSprintById(input: { sprintId: string; teamId: string }) {
  const sprint = await issueSprintData.getSprintById(input);
  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }
  return sprint;
}

async function getSprintCompleteContext(input: { sprintId: string; teamId: string }) {
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  const [plannedSprints, undoneIssuesCount] = await Promise.all([
    issueSprintData.listPlannedSprintsForTeam({ teamId: input.teamId }),
    issueSprintData.countUndoneIssuesInSprint({ sprintId: input.sprintId }),
  ]);

  return {
    sprint,
    plannedSprints: plannedSprints.filter((plannedSprint) => plannedSprint.id !== input.sprintId),
    hasUndoneIssues: undoneIssuesCount > 0,
  };
}

/**
 * Get the active sprint for a team.
 * @param input team id and active sprint id
 * @returns active sprint or null
 */
async function getActiveSprint(input: { teamId: string; activeSprintId: string | null }) {
  if (!input.activeSprintId) {
    return null;
  }
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.activeSprintId,
    teamId: input.teamId,
  });
  if (!sprint || sprint.status !== "active") {
    return null;
  }
  return sprint;
}

/**
 * Create a new planned sprint.
 * @param input sprint details and team id
 * @returns newly created sprint
 */
async function createSprint(input: {
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  createdById: string;
  teamId: string;
}) {
  return issueSprintData.createSprint({
    name: input.name,
    goal: input.goal,
    startDate: input.startDate,
    endDate: input.endDate,
    createdById: input.createdById,
    teamId: input.teamId,
  });
}

async function startSprint(input: {
  sprintId: string;
  teamId: string;
  activeSprintId: string | null;
}) {
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  if (sprint.archivedAt) {
    throw new BadRequestError("Cannot start archived sprint", ErrorCode.CANNOT_START_ARCHIVED_SPRINT);
  }

  if (sprint.status === "completed") {
    throw new BadRequestError("Cannot start completed sprint", ErrorCode.CANNOT_START_COMPLETED_SPRINT);
  }

  if (sprint.status === "active") {
    throw new BadRequestError("Sprint is already active", ErrorCode.SPRINT_ALREADY_ACTIVE);
  }

  if (input.activeSprintId) {
    throw new BadRequestError(
      "Cannot start sprint while another sprint is active",
      ErrorCode.CANNOT_START_WHILE_SPRINT_ACTIVE,
    );
  }

  await issueSprintData.setSprintStatus({
    sprintId: input.sprintId,
    status: "active",
  });

  await issueSprintData.setActiveSprintOnTeam({
    teamId: input.teamId,
    sprintId: input.sprintId,
  });

  const startedSprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!startedSprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  return startedSprint;
}

/**
 * Update an existing sprint.
 * @param input sprint id, team id, and updated fields
 * @returns updated sprint
 * @throws NotFoundError if sprint not found
 * @throws BadRequestError if sprint is already completed
 */
async function updateSprint(input: {
  sprintId: string;
  teamId: string;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
}) {
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  if (sprint.archivedAt) {
    throw new BadRequestError("Cannot update archived sprint", ErrorCode.CANNOT_UPDATE_ARCHIVED_SPRINT);
  }

  if (sprint.status === "completed") {
    throw new BadRequestError("Cannot update completed sprint", ErrorCode.CANNOT_UPDATE_COMPLETED_SPRINT);
  }

  return issueSprintData.updateSprint({
    sprintId: input.sprintId,
    name: input.name,
    goal: input.goal,
    startDate: input.startDate,
    endDate: input.endDate,
  });
}

/**
 * Mark a sprint as completed and clear the active sprint from the team.
 * @param input sprint id and team id
 * @throws NotFoundError if sprint not found
 * @throws BadRequestError if sprint is already completed
 */
async function completeSprint(input: {
  sprintId: string;
  teamId: string;
  createdById: string;
  activeSprintId: string | null;
  completion: CompleteIssueSprint;
}) {
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  if (sprint.archivedAt) {
    throw new BadRequestError("Cannot complete archived sprint", ErrorCode.CANNOT_COMPLETE_ARCHIVED_SPRINT);
  }

  if (sprint.status === "completed") {
    throw new BadRequestError("Sprint already completed", ErrorCode.SPRINT_ALREADY_COMPLETED);
  }

  if (sprint.status !== "active") {
    throw new BadRequestError(
      "Only active sprints can be completed",
      ErrorCode.ONLY_ACTIVE_SPRINTS_CAN_BE_COMPLETED,
    );
  }

  if (input.activeSprintId !== input.sprintId) {
    throw new BadRequestError("Sprint is not currently active", ErrorCode.SPRINT_NOT_CURRENTLY_ACTIVE);
  }

  if (input.completion.onUndoneIssues === "moveToBacklog") {
    await issueSprintData.moveActiveIssuesToBacklog({
      teamId: input.teamId,
      sprintId: input.sprintId,
    });
  } else if (input.completion.onUndoneIssues === "moveToPlannedSprint") {
    const targetSprint = await issueSprintData.getSprintById({
      sprintId: input.completion.targetSprintId,
      teamId: input.teamId,
    });

    if (!targetSprint) {
      throw new NotFoundError("Target sprint not found", ErrorCode.TARGET_SPRINT_NOT_FOUND);
    }

    if (targetSprint.status !== "planned") {
      throw new BadRequestError("Target sprint must be planned", ErrorCode.TARGET_SPRINT_MUST_BE_PLANNED);
    }

    await issueSprintData.moveActiveIssuesToSprint({
      teamId: input.teamId,
      fromSprintId: input.sprintId,
      toSprintId: input.completion.targetSprintId,
    });
  } else {
    const nextSprintStartDate = new Date(input.completion.newSprint.startDate);
    nextSprintStartDate.setUTCHours(0, 0, 0, 0);
    const nextSprintEndDate = new Date(input.completion.newSprint.endDate);
    nextSprintEndDate.setUTCHours(23, 59, 59, 999);

    const newSprint = await issueSprintData.createSprint({
      name: input.completion.newSprint.name,
      goal: null,
      startDate: nextSprintStartDate,
      endDate: nextSprintEndDate,
      createdById: input.createdById,
      teamId: input.teamId,
    });

    await issueSprintData.moveActiveIssuesToSprint({
      teamId: input.teamId,
      fromSprintId: input.sprintId,
      toSprintId: newSprint.id,
    });
  }

  await issueSprintData.completeSprint({ sprintId: input.sprintId });
  await issueSprintData.setActiveSprintOnTeam({ teamId: input.teamId, sprintId: null });
}

/**
 * Archive a non-active sprint and detach only undone issues.
 * @param input sprint id, team id, and active sprint id
 * @throws NotFoundError if sprint not found
 * @throws BadRequestError if sprint is active or archived
 */
async function archiveSprint(input: {
  sprintId: string;
  teamId: string;
  activeSprintId: string | null;
}) {
  const sprint = await issueSprintData.getSprintById({
    sprintId: input.sprintId,
    teamId: input.teamId,
  });

  if (!sprint) {
    throw new NotFoundError("Issue sprint not found", ErrorCode.ISSUE_SPRINT_NOT_FOUND);
  }

  if (sprint.archivedAt) {
    throw new BadRequestError("Sprint is already archived", ErrorCode.SPRINT_ALREADY_ARCHIVED);
  }

  if (input.activeSprintId === input.sprintId || sprint.status === "active") {
    throw new BadRequestError("Cannot archive active sprint", ErrorCode.CANNOT_ARCHIVE_ACTIVE_SPRINT);
  }

  await issueSprintData.moveActiveIssuesToBacklog({
    teamId: input.teamId,
    sprintId: input.sprintId,
  });

  await issueSprintData.archiveSprint({ sprintId: input.sprintId });
}

export const issueSprintService = {
  listSprints,
  getSprintById,
  getSprintCompleteContext,
  getActiveSprint,
  createSprint,
  startSprint,
  updateSprint,
  completeSprint,
  archiveSprint,
};
