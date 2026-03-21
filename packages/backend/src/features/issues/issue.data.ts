import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import type { Issue, IssueStatus, NewIssue } from "@blackwall/database/schema";
import { getNextSequenceNumber } from "./key-sequences";
import { buildChangeEvent, buildIssueUpdatedEvent } from "./change-events";
import { ErrorCode } from "@blackwall/shared";
import { BadRequestError } from "../../lib/errors";
import { ORDER_GAP, calculateMovedIssueOrder } from "./issue-order";

type PaginatedResult<T> = { issues: T[]; nextCursor: string | null };

export type ListIssuesPagination = {
  cursor?: string;
  limit?: number;
  pagination?: boolean;
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
    statusFilters?: IssueStatus[];
    withoutSprint?: boolean;
  } & ListIssuesPagination,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await db.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      deletedAt: { isNull: true },
      status: input.statusFilters ? { in: input.statusFilters } : undefined,
      sprintId: input.withoutSprint ? { isNull: true } : undefined,
      id: input.cursor ? { gt: input.cursor } : undefined,
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
    statusFilters?: IssueStatus[];
  } & ListIssuesPagination,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await db.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      sprintId: input.sprintId,
      deletedAt: { isNull: true },
      status: input.statusFilters ? { in: input.statusFilters } : undefined,
      id: input.cursor ? { gt: input.cursor } : undefined,
    },
    orderBy: { id: "asc" },
    limit: paginate ? pageSize + 1 : undefined,
    with: { assignedTo: true, labels: true, issueSprint: true },
  });

  return applyPagination(rows, pageSize, paginate);
}

export async function listIssuesAssignedToUser(
  input: { workspaceId: string; userId: string } & ListIssuesPagination,
) {
  const paginate = input.pagination !== false;
  const pageSize = input.limit ?? 50;

  const rows = await db.query.issue.findMany({
    columns: { description: false },
    where: {
      workspaceId: input.workspaceId,
      assignedToId: input.userId,
      deletedAt: { isNull: true },
      id: input.cursor ? { gt: input.cursor } : undefined,
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

export async function createIssue(input: {
  workspaceId: string;
  teamId: string;
  teamKey: string;
  createdById: string;
  issue: CreateIssueInput;
}) {
  const result = await db.transaction(async (tx) => {
    const keyNumber = await getNextSequenceNumber({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      tx,
    });

    const [issue] = await tx
      .insert(dbSchema.issue)
      .values({
        ...input.issue,
        createdById: input.createdById,
        assignedToId: input.issue.assignedToId ?? undefined,
        keyNumber,
        key: `${input.teamKey}-${keyNumber}`,
        teamId: input.teamId,
        workspaceId: input.workspaceId,
      })
      .returning();

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: issue.id,
          workspaceId: input.workspaceId,
          actorId: input.createdById,
        },
        "issue_created",
      ),
    );

    return issue;
  });

  if (!result) {
    throw new Error("Issue couldn't be created.");
  }

  return result;
}

export async function getIssueById(input: { issueId: string }) {
  return db.query.issue.findFirst({
    where: {
      id: input.issueId,
      deletedAt: { isNull: true },
    },
    with: {
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
    },
  });
}

export async function getIssueByKey(input: { workspaceId: string; issueKey: string }) {
  return db.query.issue.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.issueKey,
      deletedAt: { isNull: true },
    },
    with: {
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
    },
  });
}

export async function getIssuesByIds(input: { issueIds: string[]; workspaceId: string }) {
  return db.query.issue.findMany({
    where: {
      id: { in: input.issueIds },
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

export async function updateIssue(input: {
  issueId: string;
  workspaceId: string;
  actorId: string;
  updates: UpdateIssueInput;
  originalIssue: Issue;
}) {
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(dbSchema.issue)
      .set(input.updates)
      .where(eq(dbSchema.issue.id, input.issueId))
      .returning();

    const event = buildIssueUpdatedEvent(
      {
        issueId: input.issueId,
        workspaceId: input.workspaceId,
        actorId: input.actorId,
      },
      input.updates,
      input.originalIssue,
    );

    if (event) {
      await tx.insert(dbSchema.issueChangeEvent).values(event);
    }

    return updated;
  });

  return result;
}

export async function updateIssuesBulk(input: {
  issueIds: string[];
  workspaceId: string;
  actorId: string;
  updates: UpdateIssueInput;
}) {
  const issues = await getIssuesByIds(input);

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(dbSchema.issue)
      .set(input.updates)
      .where(inArray(dbSchema.issue.id, input.issueIds))
      .returning();

    const events = issues
      .map((issue) => {
        return buildIssueUpdatedEvent(
          {
            issueId: issue.id,
            workspaceId: input.workspaceId,
            actorId: input.actorId,
          },
          input.updates,
          issue,
        );
      })
      .filter((event) => event !== null);

    if (events.length > 0) {
      await tx.insert(dbSchema.issueChangeEvent).values(events);
    }

    return updated;
  });

  return result;
}

export async function softDeleteIssuesBulk(input: {
  issueIds: string[];
  workspaceId: string;
  actorId: string;
}) {
  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(dbSchema.issue)
      .set({ deletedAt: new Date() })
      .where(inArray(dbSchema.issue.id, input.issueIds))
      .returning();

    return updated;
  });

  return result;
}

async function listIssuesInLane(
  client: any,
  input: {
    workspaceId: string;
    teamId: string;
    sprintId: string | null;
    status: IssueStatus;
    excludeIssueId?: string;
  },
) {
  return client
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
    .orderBy(asc(dbSchema.issue.sortOrder), asc(dbSchema.issue.keyNumber)) as Promise<LaneIssue[]>;
}

async function rebalanceIssueOrders(
  tx: any,
  input: {
    workspaceId: string;
    teamId: string;
    sprintId: string | null;
    status: IssueStatus;
    excludeIssueId?: string;
  },
) {
  const laneIssues = await listIssuesInLane(tx, input);

  for (let index = 0; index < laneIssues.length; index++) {
    const nextOrder = (index + 1) * ORDER_GAP;
    if (laneIssues[index]!.sortOrder !== nextOrder) {
      await tx
        .update(dbSchema.issue)
        .set({ sortOrder: nextOrder })
        .where(eq(dbSchema.issue.id, laneIssues[index]!.id));
      laneIssues[index]!.sortOrder = nextOrder;
    }
  }

  return laneIssues;
}

export async function moveIssue(input: {
  workspaceId: string;
  issueId: string;
  teamId: string;
  sprintId: string | null;
  status: IssueStatus;
  previousIssueId: string | null;
  nextIssueId: string | null;
}) {
  await db.transaction(async (tx) => {
    let laneIssues = await listIssuesInLane(tx, {
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
      throw new BadRequestError(
        "Previous issue is not in the target column",
        ErrorCode.PREVIOUS_ISSUE_NOT_IN_TARGET_COLUMN,
      );
    }

    if (input.nextIssueId && !nextIssue) {
      throw new BadRequestError(
        "Next issue is not in the target column",
        ErrorCode.NEXT_ISSUE_NOT_IN_TARGET_COLUMN,
      );
    }

    if ((input.previousIssueId === null || input.nextIssueId === null) && laneIssues.length === 0) {
      // empty target lane is valid
    } else if (input.previousIssueId === null && input.nextIssueId === null) {
      throw new BadRequestError(
        "A non-empty target column requires a previous or next issue",
        ErrorCode.TARGET_COLUMN_REQUIRES_ADJACENT_ISSUE,
      );
    }

    let sortOrder = calculateMovedIssueOrder({
      previousOrder: previousIssue?.sortOrder ?? null,
      nextOrder: nextIssue?.sortOrder ?? null,
    });

    if (sortOrder === null) {
      laneIssues = await rebalanceIssueOrders(tx, {
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
      throw new BadRequestError(
        "Unable to determine issue sort order for this move",
        ErrorCode.UNABLE_TO_DETERMINE_ISSUE_SORT_ORDER,
      );
    }

    await tx
      .update(dbSchema.issue)
      .set({ sortOrder, status: input.status })
      .where(eq(dbSchema.issue.id, input.issueId));
  });
}

export async function softDeleteIssue(input: { issueId: string }) {
  await db
    .update(dbSchema.issue)
    .set({ deletedAt: new Date() })
    .where(eq(dbSchema.issue.id, input.issueId));
}

export const issueData = {
  listIssuesInTeam,
  listIssuesInSprint,
  listIssuesAssignedToUser,
  createIssue,
  getIssueById,
  getIssueByKey,
  updateIssue,
  softDeleteIssue,
  getIssuesByIds,
  updateIssuesBulk,
  softDeleteIssuesBulk,
  moveIssue,
};
