import { and, eq, isNull, sql } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import { buildChangeEvent } from "../issues/change-events";

export async function createTimeEntry(input: {
  issueId: string;
  workspaceId: string;
  userId: string;
  duration: number;
  description?: string;
}) {
  const result = await db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(dbSchema.timeEntry)
      .values({
        issueId: input.issueId,
        userId: input.userId,
        duration: input.duration,
        description: input.description,
      })
      .returning();

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          actorId: input.userId,
        },
        "time_logged",
        entry.id,
      ),
    );

    return entry;
  });

  return result;
}

export async function listTimeEntriesForIssue(input: { issueId: string }) {
  return db.query.timeEntry.findMany({
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

export async function getTimeEntryById(input: { timeEntryId: string; issueId: string }) {
  return db.query.timeEntry.findFirst({
    where: {
      id: input.timeEntryId,
      issueId: input.issueId,
      deletedAt: { isNull: true },
    },
  });
}

export async function softDeleteTimeEntry(input: { timeEntryId: string }) {
  await db
    .update(dbSchema.timeEntry)
    .set({ deletedAt: sql`(unixepoch() * 1000)` })
    .where(eq(dbSchema.timeEntry.id, input.timeEntryId));
}

export async function getTotalTimeLoggedForIssue(input: { issueId: string }) {
  const result = await db
    .select({
      total: sql<number>`coalesce(sum(${dbSchema.timeEntry.duration}), 0)`,
    })
    .from(dbSchema.timeEntry)
    .where(
      and(eq(dbSchema.timeEntry.issueId, input.issueId), isNull(dbSchema.timeEntry.deletedAt)),
    );

  return result[0]?.total ?? 0;
}

export const timeEntryData = {
  createTimeEntry,
  listTimeEntriesForIssue,
  getTimeEntryById,
  softDeleteTimeEntry,
  getTotalTimeLoggedForIssue,
};
