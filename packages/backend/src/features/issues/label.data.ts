import { and, count, eq } from "drizzle-orm";
import { dbSchema, type DbHandle, type DbTransaction } from "@blackwall/database";
import type { ColorKey } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";

/** Throws a unique violation when the workspace has a label with this name, ignoring case. */
export function insertLabel(
  handle: DbHandle,
  input: { name: string; colorKey: ColorKey; workspaceId: string },
) {
  const [label] = handle
    .insert(dbSchema.label)
    .values({
      name: input.name,
      colorKey: input.colorKey,
      workspaceId: input.workspaceId,
    })
    .returning()
    .all();

  return label;
}

export async function getLabelById(
  input: { labelId: string; workspaceId: string },
  handle: DbHandle,
) {
  return handle.query.label.findFirst({
    where: {
      id: input.labelId,
      workspaceId: input.workspaceId,
    },
  });
}

export async function getLabelsForWorkspace(input: { workspaceId: string }, handle: DbHandle) {
  return handle.query.label.findMany({
    where: { workspaceId: input.workspaceId },
  });
}

/** @returns whether a label was deleted */
export async function deleteLabel(
  input: { labelId: string; workspaceId: string },
  handle: DbHandle,
) {
  const deleted = await handle
    .delete(dbSchema.label)
    .where(
      and(eq(dbSchema.label.id, input.labelId), eq(dbSchema.label.workspaceId, input.workspaceId)),
    )
    .returning({ id: dbSchema.label.id });

  return deleted.length > 0;
}

export function countLabelsOnIssue(tx: DbTransaction, input: { issueId: string }) {
  const [row] = tx
    .select({ count: count() })
    .from(dbSchema.labelOnIssue)
    .where(eq(dbSchema.labelOnIssue.issueId, input.issueId))
    .all();

  return row?.count ?? 0;
}

/**
 * Attaches the label and records a `label_added` event. Attaching a label the
 * issue already has does nothing.
 * @returns whether the label was attached
 */
export function attachLabel(
  tx: DbTransaction,
  input: { issueId: string; labelId: string; workspaceId: string; actorId: string },
) {
  const attached = tx
    .insert(dbSchema.labelOnIssue)
    .values({ issueId: input.issueId, labelId: input.labelId, workspaceId: input.workspaceId })
    .onConflictDoNothing()
    .returning()
    .all();
  if (attached.length === 0) return false;

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        { issueId: input.issueId, workspaceId: input.workspaceId, actorId: input.actorId },
        "label_added",
        { labelId: input.labelId },
      ),
    )
    .run();
  return true;
}

/**
 * Detaches the label and records a `label_removed` event. Detaching a label the
 * issue doesn't have does nothing.
 * @returns whether the label was detached
 */
export function detachLabel(
  tx: DbTransaction,
  input: { issueId: string; labelId: string; workspaceId: string; actorId: string },
) {
  const detached = tx
    .delete(dbSchema.labelOnIssue)
    .where(
      and(
        eq(dbSchema.labelOnIssue.issueId, input.issueId),
        eq(dbSchema.labelOnIssue.labelId, input.labelId),
      ),
    )
    .returning()
    .all();
  if (detached.length === 0) return false;

  tx.insert(dbSchema.issueChangeEvent)
    .values(
      buildChangeEvent(
        { issueId: input.issueId, workspaceId: input.workspaceId, actorId: input.actorId },
        "label_removed",
        { labelId: input.labelId },
      ),
    )
    .run();
  return true;
}

export const labelData = {
  insertLabel,
  getLabelById,
  getLabelsForWorkspace,
  deleteLabel,
  countLabelsOnIssue,
  attachLabel,
  detachLabel,
};
