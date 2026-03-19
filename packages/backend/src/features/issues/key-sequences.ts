import { db, dbSchema, type DbTransaction } from "@blackwall/database";
import { and, eq, sql } from "drizzle-orm";

export async function ensureSequenceExists(input: {
  workspaceId: string;
  teamId: string;
  tx?: DbTransaction;
}): Promise<void> {
  const transactionalDb = input.tx ?? db;

  await transactionalDb
    .insert(dbSchema.issueSequence)
    .values({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      currentSequence: 0,
    })
    .onConflictDoNothing();
}

export async function getNextSequenceNumber(input: {
  workspaceId: string;
  teamId: string;
  tx?: DbTransaction;
}): Promise<number> {
  await ensureSequenceExists(input);

  const transactionalDb = input.tx ?? db;

  const [updated] = await transactionalDb
    .update(dbSchema.issueSequence)
    .set({
      currentSequence: sql`${dbSchema.issueSequence.currentSequence} + 1`,
    })
    .where(
      and(
        eq(dbSchema.issueSequence.workspaceId, input.workspaceId),
        eq(dbSchema.issueSequence.teamId, input.teamId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Failed to get next sequence number.");
  }

  return updated.currentSequence;
}
