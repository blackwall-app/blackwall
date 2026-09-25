import { db, dbSchema, type DbTransaction } from "@blackwall/database";
import { eq, sql } from "drizzle-orm";

export function ensureSequenceExists(input: {
  teamId: string;
  tx?: DbTransaction;
}): void {
  const transactionalDb = input.tx ?? db;

  transactionalDb
    .insert(dbSchema.issueSequence)
    .values({
      teamId: input.teamId,
      currentSequence: 0,
    })
    .onConflictDoNothing()
    .run();
}

export function getNextSequenceNumber(input: {
  teamId: string;
  tx?: DbTransaction;
}): number {
  ensureSequenceExists(input);

  const transactionalDb = input.tx ?? db;

  const [updated] = transactionalDb
    .update(dbSchema.issueSequence)
    .set({
      currentSequence: sql`${dbSchema.issueSequence.currentSequence} + 1`,
    })
    .where(eq(dbSchema.issueSequence.teamId, input.teamId))
    .returning()
    .all();

  if (!updated) {
    throw new Error("Failed to get next sequence number.");
  }

  return updated.currentSequence;
}
