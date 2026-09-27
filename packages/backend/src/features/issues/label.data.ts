import { and, count, eq } from "drizzle-orm";
import { db, dbSchema, type DbHandle } from "@blackwall/database";
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

export async function addLabelToIssue(input: {
  issueId: string;
  labelId: string;
  workspaceId: string;
  actorId: string;
}) {
  const [labelCount] = await db
    .select({
      count: count(),
    })
    .from(dbSchema.labelOnIssue)
    .where(eq(dbSchema.labelOnIssue.issueId, input.issueId));

  if (!labelCount || labelCount.count >= 100) {
    throw new Error("The issue has a maximum amount of labels.");
  }

  await db.transaction((tx) => {
    tx.insert(dbSchema.labelOnIssue)
      .values({
        issueId: input.issueId,
        labelId: input.labelId,
        workspaceId: input.workspaceId,
      })
      .run();

    tx.insert(dbSchema.issueChangeEvent)
      .values(
        buildChangeEvent(
          {
            issueId: input.issueId,
            workspaceId: input.workspaceId,
            actorId: input.actorId,
          },
          "label_added",
          { labelId: input.labelId },
        ),
      )
      .run();
  });
}

export async function removeLabelFromIssue(input: {
  issueId: string;
  labelId: string;
  workspaceId: string;
  actorId: string;
}) {
  await db.transaction((tx) => {
    tx.delete(dbSchema.labelOnIssue)
      .where(
        and(
          eq(dbSchema.labelOnIssue.issueId, input.issueId),
          eq(dbSchema.labelOnIssue.labelId, input.labelId),
        ),
      )
      .run();

    tx.insert(dbSchema.issueChangeEvent)
      .values(
        buildChangeEvent(
          {
            issueId: input.issueId,
            workspaceId: input.workspaceId,
            actorId: input.actorId,
          },
          "label_removed",
          { labelId: input.labelId },
        ),
      )
      .run();
  });
}

export const labelData = {
  insertLabel,
  getLabelById,
  getLabelsForWorkspace,
  deleteLabel,
  addLabelToIssue,
  removeLabelFromIssue,
};
