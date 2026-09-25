import { and, count, eq, sql } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import type { ColorKey } from "@blackwall/database/schema";
import { buildChangeEvent } from "./change-events";
import { isSqliteUniqueConstraintError } from "../../lib/errors";

export async function createLabel(input: {
  name: string;
  colorKey: ColorKey;
  workspaceId: string;
}) {
  try {
    const [label] = await db
      .insert(dbSchema.label)
      .values({
        name: input.name,
        colorKey: input.colorKey,
        workspaceId: input.workspaceId,
      })
      .returning();

    return label;
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      throw new Error("Label with this name already exists");
    }
    throw error;
  }
}

export async function getLabelById(input: { labelId: string; workspaceId: string }) {
  return db.query.label.findFirst({
    where: {
      id: input.labelId,
      workspaceId: input.workspaceId,
    },
  });
}

/** Case-insensitive, matching the unique index on (workspace_id, name collate nocase). */
export async function getLabelByName(input: { name: string; workspaceId: string }) {
  return db.query.label.findFirst({
    where: {
      workspaceId: input.workspaceId,
      RAW: (label) => sql`${label.name} = ${input.name} collate nocase`,
    },
  });
}

export async function getLabelsForWorkspace(input: { workspaceId: string }) {
  return db.query.label.findMany({
    where: { workspaceId: input.workspaceId },
  });
}

export async function deleteLabel(input: { labelId: string; workspaceId: string }) {
  await db
    .delete(dbSchema.label)
    .where(
      and(eq(dbSchema.label.id, input.labelId), eq(dbSchema.label.workspaceId, input.workspaceId)),
    );
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

  await db.transaction(async (tx) => {
    await tx.insert(dbSchema.labelOnIssue).values({
      issueId: input.issueId,
      labelId: input.labelId,
      workspaceId: input.workspaceId,
    });

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          actorId: input.actorId,
        },
        "label_added",
        { labelId: input.labelId },
      ),
    );
  });
}

export async function removeLabelFromIssue(input: {
  issueId: string;
  labelId: string;
  workspaceId: string;
  actorId: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .delete(dbSchema.labelOnIssue)
      .where(
        and(
          eq(dbSchema.labelOnIssue.issueId, input.issueId),
          eq(dbSchema.labelOnIssue.labelId, input.labelId),
        ),
      );

    await tx.insert(dbSchema.issueChangeEvent).values(
      buildChangeEvent(
        {
          issueId: input.issueId,
          workspaceId: input.workspaceId,
          actorId: input.actorId,
        },
        "label_removed",
        { labelId: input.labelId },
      ),
    );
  });
}

export const labelData = {
  createLabel,
  getLabelById,
  getLabelByName,
  getLabelsForWorkspace,
  deleteLabel,
  addLabelToIssue,
  removeLabelFromIssue,
};
