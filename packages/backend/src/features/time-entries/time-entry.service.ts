import { ErrorCode } from "@blackwall/shared";
import { timeEntryData } from "./time-entry.data";
import { BadRequestError, NotFoundError } from "../../lib/errors";

/**
 * Create a new time entry for an issue.
 * @param input issue id, workspace id, user id, duration in minutes, and optional description
 * @returns created time entry
 * @throws BadRequestError if duration is not positive
 */
async function createTimeEntry(input: {
  issueId: string;
  workspaceId: string;
  userId: string;
  duration: number;
  description?: string;
}) {
  if (input.duration <= 0) {
    throw new BadRequestError("Duration must be positive", ErrorCode.DURATION_MUST_BE_POSITIVE);
  }

  return timeEntryData.createTimeEntry(input);
}

/**
 * List all time entries for an issue.
 * @param input issue id
 * @returns list of time entries
 */
async function listTimeEntriesForIssue(input: { issueId: string }) {
  return timeEntryData.listTimeEntriesForIssue(input);
}

/**
 * Soft delete a time entry.
 * @param input time entry id, issue id, and user id
 * @throws NotFoundError if time entry not found
 */
async function deleteTimeEntry(input: { timeEntryId: string; issueId: string; userId: string }) {
  const entry = await timeEntryData.getTimeEntryById({
    timeEntryId: input.timeEntryId,
    issueId: input.issueId,
  });

  if (!entry) {
    throw new NotFoundError("Time entry not found", ErrorCode.TIME_ENTRY_NOT_FOUND);
  }

  await timeEntryData.softDeleteTimeEntry({ timeEntryId: input.timeEntryId });
}

/**
 * Get the total time logged for an issue in minutes.
 * @param input issue id
 * @returns total minutes logged
 */
async function getTotalTimeLoggedForIssue(input: { issueId: string }) {
  return timeEntryData.getTotalTimeLoggedForIssue(input);
}

export const timeEntryService = {
  createTimeEntry,
  listTimeEntriesForIssue,
  deleteTimeEntry,
  getTotalTimeLoggedForIssue,
};
