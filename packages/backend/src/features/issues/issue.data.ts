import { EmptyFilter, and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, dbSchema, type DbHandle, type DbTransaction } from "@blackwall/database";
import type { Issue, IssueStatus, NewIssue } from "@blackwall/database/schema";
import {
  NextIssueNotInTargetColumn,
  PreviousIssueNotInTargetColumn,
  TargetColumnRequiresAdjacentIssue,
  UnableToDetermineIssueSortOrder,
  tiptapToPlainText,
} from "@blackwall/shared";
import { getNextSequenceNumber } from "./key-sequences";
import { buildChangeEvent, buildIssueUpdatedEvent } from "./change-events";
import { ORDER_GAP, calculateMovedIssueOrder } from "./issue-order";

type PaginatedResult<T> = { issues: T[]; nextCursor: string | null };

export type ListIssuesPagination = {
  cursor?: string | undefined;
  limit?: number | undefined;
  pagination?: boolean | undefined;
};

function applyPagination<T extends { id: string }>(
  items: T[],
  pageSize: number,
  paginate: boolean,
): PaginatedResult<T> {
  if (!paginate) return { issues: items, nextCursor: null };
  const hasMore = items.length > pageSize;
  const page = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { issues: page, nextCursor };
}

type LaneIssue = {
  id: string;
  key: string;
  sortOrder: number;
};

export async function listIssuesInTeam(
  input: {
    workspaceId: string;
    teamId: string;
    statusFilters?: ReadonlyArray<IssueStatus> | undefined;
    withoutSprint?: boolean | undefined;
  } & ListIssuesPagination,
  handle: DbHandle,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await handle.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      deletedAt: { isNull: true },
      status: input.statusFilters ? { in: [...input.statusFilters] } : EmptyFilter,
      sprintId: input.withoutSprint ? { isNull: true } : EmptyFilter,
      id: input.cursor ? { gt: input.cursor } : EmptyFilter,
    },
    orderBy: { id: "asc" },
    limit: paginate ? pageSize + 1 : undefined,
    with: { assignedTo: true, labels: true, issueSprint: true },
  });

  return applyPagination(rows, pageSize, paginate);
}

export async function listIssuesInSprint(
  input: {
    workspaceId: string;
    teamId: string;
    sprintId: string;
    statusFilters?: ReadonlyArray<IssueStatus> | undefined;
  } & ListIssuesPagination,
  handle: DbHandle,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await handle.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      sprintId: input.sprintId,
      deletedAt: { isNull: true },
      status: input.statusFilters ? { in: [...input.statusFilters] } : EmptyFilter,
      id: input.cursor ? { gt: input.cursor } : EmptyFilter,
    },
    orderBy: { id: "asc" },
    limit: paginate ? pageSize + 1 : undefined,
    with: { assignedTo: true, labels: true, issueSprint: true },
  });

  return applyPagination(rows, pageSize, paginate);
}

export async function listIssuesAssignedToUser(
  input: { workspaceId: string; userId: string } & ListIssuesPagination,
  handle: DbHandle,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await handle.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      assignedToId: input.userId,
      deletedAt: { isNull: true },
      id: input.cursor ? { gt: input.cursor } : EmptyFilter,
    },
    orderBy: { id: "asc" },
    limit: paginate ? pageSize + 1 : undefined,
    with: { assignedTo: true, labels: true, issueSprint: true, team: true },
  });

  return applyPagination(rows, pageSize, paginate);
}

export type CreateIssueInput = Pick<
  NewIssue,
  "summary" | "description" | "status" | "assignedToId" | "sprintId"
>;

/** Takes the team's next key number and records an `issue_created` event. */
export function insertIssue(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    teamId: string;
    teamKey: string;
    createdById: string;
    issue: CreateIssueInput;
  },
) {
  const keyNumber = getNextSequenceNumber({ teamId: input.teamId, tx });

  const [issue] = tx
    .insert(dbSchema.issue)
    .values({
      ...input.issue,
      descriptionText: tiptapToPlainText(input.issue.description),
      createdById: input.createdById,
      assignedToId: input.issue.assignedToId ?? undefined,
      keyNumber,
      key: `${input.teamKey}-${keyNumber}`,
      teamId: input.teamId,
      workspaceId: input.workspaceId,
    })
    .returning()
    .all();

  if (!issue) {
    throw new Error("Issue couldn't be created.");
  }

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        { issueId: issue.id, workspaceId: input.workspaceId, actorId: input.createdById },
        "issue_created",
      ),
    )
    .run();

  return issue;
}

const issueDetailsWith = {
  assignedTo: true,
  labels: true,
  issueSprint: true,
  team: {
    with: {
      activeSprint: true,
    },
  },
  comments: {
    where: { deletedAt: { isNull: true } },
    orderBy: { id: "asc" },
    with: {
      author: true,
    },
  },
  changeEvents: {
    orderBy: { createdAt: "asc" },
    with: {
      actor: true,
    },
  },
} as const;

/**
 * Maps a key that uses a team's old key (e.g. `OLD-12` after the team was renamed to `NEW`)
 * to the issue's current key.
 * @returns the current key, or null if the prefix isn't a known alias
 */
async function resolveAliasedIssueKey(
  input: { workspaceId: string; issueKey: string },
  handle: DbHandle,
) {
  const match = /^(.+)-(\d+)$/.exec(input.issueKey);
  if (!match) return null;

  const alias = await handle.query.teamKeyAlias.findFirst({
    where: { workspaceId: input.workspaceId, key: match[1] },
  });
  if (!alias) return null;

  const issue = await handle.query.issue.findFirst({
    columns: { key: true },
    where: { teamId: alias.teamId, keyNumber: Number(match[2]) },
  });

  return issue?.key ?? null;
}

export async function getIssueByKey(
  input: { workspaceId: string; issueKey: string },
  handle: DbHandle = db,
) {
  const issue = await handle.query.issue.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.issueKey,
      deletedAt: { isNull: true },
    },
    with: issueDetailsWith,
  });
  if (issue) return issue;

  const currentKey = await resolveAliasedIssueKey(input, handle);
  if (!currentKey) return undefined;

  return handle.query.issue.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: currentKey,
      deletedAt: { isNull: true },
    },
    with: issueDetailsWith,
  });
}

export async function getIssuesByKeys(
  input: { issueKeys: ReadonlyArray<string>; workspaceId: string },
  handle: DbHandle,
) {
  return handle.query.issue.findMany({
    where: {
      key: { in: [...input.issueKeys] },
      workspaceId: input.workspaceId,
      deletedAt: { isNull: true },
    },
  });
}

export type UpdateIssueInput = Partial<
  Pick<
    NewIssue,
    | "summary"
    | "description"
    | "status"
    | "priority"
    | "assignedToId"
    | "sprintId"
    | "estimationPoints"
    | "sortOrder"
  >
>;

function withDescriptionText(updates: UpdateIssueInput) {
  if (updates.description === undefined) return updates;
  return { ...updates, descriptionText: tiptapToPlainText(updates.description) };
}

/** Records the change as an event when a field actually changed. */
export function updateIssue(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    actorId: string;
    updates: UpdateIssueInput;
    originalIssue: Issue;
  },
) {
  const [updated] = tx
    .update(dbSchema.issue)
    .set(withDescriptionText(input.updates))
    .where(eq(dbSchema.issue.id, input.originalIssue.id))
    .returning()
    .all();

  const event = buildIssueUpdatedEvent(
    { issueId: input.originalIssue.id, workspaceId: input.workspaceId, actorId: input.actorId },
    input.updates,
    input.originalIssue,
  );

  if (event) {
    tx.insert(dbSchema.issueChangeEvent).values(event).run();
  }

  if (!updated) {
    throw new Error("Issue couldn't be updated.");
  }

  return updated;
}

export function updateIssuesBulk(
  tx: DbTransaction,
  input: {
    issues: Issue[];
    workspaceId: string;
    actorId: string;
    updates: UpdateIssueInput;
  },
) {
  const updated = tx
    .update(dbSchema.issue)
    .set(withDescriptionText(input.updates))
    .where(
      and(
        eq(dbSchema.issue.workspaceId, input.workspaceId),
        inArray(
          dbSchema.issue.id,
          input.issues.map((issue) => issue.id),
        ),
      ),
    )
    .returning()
    .all();

  const events = input.issues
    .map((issue) =>
      buildIssueUpdatedEvent(
        { issueId: issue.id, workspaceId: input.workspaceId, actorId: input.actorId },
        input.updates,
        issue,
      ),
    )
    .filter((event) => event !== null);

  if (events.length > 0) {
    tx.insert(dbSchema.issueChangeEvent).values(events).run();
  }

  return updated;
}

export function softDeleteIssuesBulk(
  tx: DbTransaction,
  input: { issues: Issue[]; workspaceId: string },
) {
  return tx
    .update(dbSchema.issue)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(dbSchema.issue.workspaceId, input.workspaceId),
        inArray(
          dbSchema.issue.id,
          input.issues.map((issue) => issue.id),
        ),
      ),
    )
    .returning()
    .all();
}

function listIssuesInLane(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    teamId: string;
    sprintId: string | null;
    status: IssueStatus;
    excludeIssueId?: string;
  },
): LaneIssue[] {
  return tx
    .select({
      id: dbSchema.issue.id,
      key: dbSchema.issue.key,
      sortOrder: dbSchema.issue.sortOrder,
    })
    .from(dbSchema.issue)
    .where(
      and(
        eq(dbSchema.issue.workspaceId, input.workspaceId),
        eq(dbSchema.issue.teamId, input.teamId),
        eq(dbSchema.issue.status, input.status),
        input.sprintId === null
          ? isNull(dbSchema.issue.sprintId)
          : eq(dbSchema.issue.sprintId, input.sprintId),
        isNull(dbSchema.issue.deletedAt),
        input.excludeIssueId ? ne(dbSchema.issue.id, input.excludeIssueId) : undefined,
      ),
    )
    .orderBy(asc(dbSchema.issue.sortOrder), asc(dbSchema.issue.keyNumber))
    .all();
}

function rebalanceIssueOrders(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    teamId: string;
    sprintId: string | null;
    status: IssueStatus;
    excludeIssueId?: string;
  },
) {
  const laneIssues = listIssuesInLane(tx, input);

  for (let index = 0; index < laneIssues.length; index++) {
    const nextOrder = (index + 1) * ORDER_GAP;
    if (laneIssues[index]!.sortOrder !== nextOrder) {
      tx.update(dbSchema.issue)
        .set({ sortOrder: nextOrder })
        .where(eq(dbSchema.issue.id, laneIssues[index]!.id))
        .run();
      laneIssues[index]!.sortOrder = nextOrder;
    }
  }

  return laneIssues;
}

/**
 * Places the issue between its neighbors in the target lane, rebalancing the
 * lane when there's no gap left. Throws the move's domain errors, which roll
 * the transaction back.
 */
export function moveIssue(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    issueId: string;
    teamId: string;
    sprintId: string | null;
    status: IssueStatus;
    previousIssueId: string | null;
    nextIssueId: string | null;
  },
) {
  let laneIssues = listIssuesInLane(tx, {
    workspaceId: input.workspaceId,
    teamId: input.teamId,
    sprintId: input.sprintId,
    status: input.status,
    excludeIssueId: input.issueId,
  });

  const previousIssue = input.previousIssueId
    ? (laneIssues.find((issue) => issue.id === input.previousIssueId) ?? null)
    : null;
  const nextIssue = input.nextIssueId
    ? (laneIssues.find((issue) => issue.id === input.nextIssueId) ?? null)
    : null;

  if (input.previousIssueId && !previousIssue) {
    throw new PreviousIssueNotInTargetColumn();
  }

  if (input.nextIssueId && !nextIssue) {
    throw new NextIssueNotInTargetColumn();
  }

  if ((input.previousIssueId === null || input.nextIssueId === null) && laneIssues.length === 0) {
    // empty target lane is valid
  } else if (input.previousIssueId === null && input.nextIssueId === null) {
    throw new TargetColumnRequiresAdjacentIssue();
  }

  let sortOrder = calculateMovedIssueOrder({
    previousOrder: previousIssue?.sortOrder ?? null,
    nextOrder: nextIssue?.sortOrder ?? null,
  });

  if (sortOrder === null) {
    laneIssues = rebalanceIssueOrders(tx, {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      sprintId: input.sprintId,
      status: input.status,
      excludeIssueId: input.issueId,
    });

    const rebalancedPreviousIssue = input.previousIssueId
      ? (laneIssues.find((issue) => issue.id === input.previousIssueId) ?? null)
      : null;
    const rebalancedNextIssue = input.nextIssueId
      ? (laneIssues.find((issue) => issue.id === input.nextIssueId) ?? null)
      : null;

    sortOrder = calculateMovedIssueOrder({
      previousOrder: rebalancedPreviousIssue?.sortOrder ?? null,
      nextOrder: rebalancedNextIssue?.sortOrder ?? null,
    });
  }

  if (sortOrder === null) {
    throw new UnableToDetermineIssueSortOrder();
  }

  tx.update(dbSchema.issue)
    .set({ sortOrder, status: input.status })
    .where(eq(dbSchema.issue.id, input.issueId))
    .run();
}

export async function softDeleteIssue(input: { issueId: string }, handle: DbHandle) {
  await handle
    .update(dbSchema.issue)
    .set({ deletedAt: new Date() })
    .where(eq(dbSchema.issue.id, input.issueId));
}

export const issueData = {
  listIssuesInTeam,
  listIssuesInSprint,
  listIssuesAssignedToUser,
  insertIssue,
  getIssueByKey,
  updateIssue,
  softDeleteIssue,
  getIssuesByKeys,
  updateIssuesBulk,
  softDeleteIssuesBulk,
  moveIssue,
};
