import { and, eq, inArray, sql } from "drizzle-orm";
import { dbSchema, type DbHandle } from "@blackwall/database";
import type { IssueStatus, IssueSprintStatus } from "@blackwall/database/schema";

const ACTIVE_ISSUE_STATUSES = ["to_do", "in_progress"] as IssueStatus[];

export async function listSprintsForTeam(input: { teamId: string }, handle: DbHandle) {
  return handle.query.issueSprint.findMany({
    where: {
      teamId: input.teamId,
      archivedAt: { isNull: true },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPlannedSprintsForTeam(input: { teamId: string }, handle: DbHandle) {
  return handle.query.issueSprint.findMany({
    where: {
      teamId: input.teamId,
      status: "planned",
      archivedAt: { isNull: true },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSprintById(input: { sprintId: string; teamId: string }, handle: DbHandle) {
  return handle.query.issueSprint.findFirst({
    where: {
      id: input.sprintId,
      teamId: input.teamId,
    },
  });
}

export function insertSprint(
  tx: DbHandle,
  input: {
    name: string;
    goal: string | null;
    startDate: Date;
    endDate: Date;
    createdById: string;
    teamId: string;
  },
) {
  const [sprint] = tx
    .insert(dbSchema.issueSprint)
    .values({ ...input, status: "planned" })
    .returning()
    .all();

  return sprint;
}

export function updateSprint(
  tx: DbHandle,
  input: {
    sprintId: string;
    name: string;
    goal: string | null;
    startDate: Date;
    endDate: Date;
  },
) {
  const [sprint] = tx
    .update(dbSchema.issueSprint)
    .set({
      name: input.name,
      goal: input.goal,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .where(eq(dbSchema.issueSprint.id, input.sprintId))
    .returning()
    .all();

  return sprint;
}

export function setSprintStatus(
  tx: DbHandle,
  input: { sprintId: string; status: IssueSprintStatus },
) {
  const [sprint] = tx
    .update(dbSchema.issueSprint)
    .set({ status: input.status })
    .where(eq(dbSchema.issueSprint.id, input.sprintId))
    .returning()
    .all();

  return sprint;
}

export function completeSprint(tx: DbHandle, input: { sprintId: string }) {
  tx.update(dbSchema.issueSprint)
    .set({ status: "completed", finishedAt: new Date() })
    .where(eq(dbSchema.issueSprint.id, input.sprintId))
    .run();
}

export function archiveSprint(tx: DbHandle, input: { sprintId: string }) {
  tx.update(dbSchema.issueSprint)
    .set({ archivedAt: sql`(unixepoch() * 1000)` })
    .where(eq(dbSchema.issueSprint.id, input.sprintId))
    .run();
}

/** Moves the sprint's unfinished issues to `toSprintId`, or to the backlog when it's `null`. */
export function moveUndoneIssues(
  tx: DbHandle,
  input: { fromSprintId: string; toSprintId: string | null },
) {
  tx.update(dbSchema.issue)
    .set({ sprintId: input.toSprintId })
    .where(
      and(
        eq(dbSchema.issue.sprintId, input.fromSprintId),
        inArray(dbSchema.issue.status, ACTIVE_ISSUE_STATUSES),
      ),
    )
    .run();
}

export async function countUndoneIssuesInSprint(input: { sprintId: string }, handle: DbHandle) {
  const [result] = await handle
    .select({ count: sql<number>`count(*)` })
    .from(dbSchema.issue)
    .where(
      and(
        eq(dbSchema.issue.sprintId, input.sprintId),
        inArray(dbSchema.issue.status, ACTIVE_ISSUE_STATUSES),
      ),
    );

  return Number(result?.count ?? 0);
}

export const issueSprintData = {
  listSprintsForTeam,
  listPlannedSprintsForTeam,
  getSprintById,
  insertSprint,
  updateSprint,
  setSprintStatus,
  completeSprint,
  archiveSprint,
  moveUndoneIssues,
  countUndoneIssuesInSprint,
};
