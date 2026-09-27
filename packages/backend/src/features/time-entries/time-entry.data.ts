import { and, eq, isNull, sql } from "drizzle-orm";
import { dbSchema, type DbHandle, type DbTransaction } from "@blackwall/database";
import { buildChangeEvent } from "../issues/change-events";

export function insertTimeEntry(
  tx: DbTransaction,
  input: {
    issueId: string;
    workspaceId: string;
    userId: string;
    durationMinutes: number;
    description?: string;
  },
) {
  const [entry] = tx
    .insert(dbSchema.timeEntry)
    .values({
      issueId: input.issueId,
      userId: input.userId,
      durationMinutes: input.durationMinutes,
      description: input.description,
    })
    .returning()
    .all();

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        {
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          actorId: input.userId,
        },
        "time_logged",
        { timeEntryId: entry.id },
      ),
    )
    .run();

  return entry;
}

export async function listTimeEntriesForIssue(input: { issueId: string }, handle: DbHandle) {
  return handle.query.timeEntry.findMany({
    where: {
      issueId: input.issueId,
      deletedAt: { isNull: true },
    },
    orderBy: { createdAt: "desc" },
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });
}

/** Soft deletes the entry if it belongs to the issue. Returns it, or `undefined` if there was none. */
export async function softDeleteTimeEntry(
  input: { timeEntryId: string; issueId: string },
  handle: DbHandle,
) {
  const [entry] = await handle
    .update(dbSchema.timeEntry)
    .set({ deletedAt: sql`(unixepoch() * 1000)` })
    .where(
      and(
        eq(dbSchema.timeEntry.id, input.timeEntryId),
        eq(dbSchema.timeEntry.issueId, input.issueId),
        isNull(dbSchema.timeEntry.deletedAt),
      ),
    )
    .returning();

  return entry;
}

export async function getTotalTimeLoggedForIssue(input: { issueId: string }, handle: DbHandle) {
  const result = await handle
    .select({
      total: sql<number>`coalesce(sum(${dbSchema.timeEntry.durationMinutes}), 0)`,
    })
    .from(dbSchema.timeEntry)
    .where(
      and(eq(dbSchema.timeEntry.issueId, input.issueId), isNull(dbSchema.timeEntry.deletedAt)),
    );

  return result[0]?.total ?? 0;
}

export const timeEntryData = {
  insertTimeEntry,
  listTimeEntriesForIssue,
  softDeleteTimeEntry,
  getTotalTimeLoggedForIssue,
};
