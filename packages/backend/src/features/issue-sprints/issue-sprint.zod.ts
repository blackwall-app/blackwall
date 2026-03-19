import { z } from "zod";
import { issueSprintStatusValues } from "@blackwall/database/schema";

const sprintBaseSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().max(500).nullable(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

const withValidDateRange = <TSchema extends z.ZodType<{ startDate: string; endDate: string }>>(
  schema: TSchema,
) =>
  schema.refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const createIssueSprintSchema = withValidDateRange(sprintBaseSchema);

export type CreateIssueSprint = z.infer<typeof createIssueSprintSchema>;

import { issueSchema } from "../issues/issue.zod";

export const updateIssueSprintSchema = withValidDateRange(sprintBaseSchema);

export type UpdateIssueSprint = z.infer<typeof updateIssueSprintSchema>;

const newSprintForCompletionSchema = withValidDateRange(
  z.object({
    name: z.string().min(1).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }),
);

export const completeIssueSprintSchema = z.discriminatedUnion("onUndoneIssues", [
  z.object({
    onUndoneIssues: z.literal("moveToBacklog"),
  }),
  z.object({
    onUndoneIssues: z.literal("moveToPlannedSprint"),
    targetSprintId: z.string(),
  }),
  z.object({
    onUndoneIssues: z.literal("moveToNewSprint"),
    newSprint: newSprintForCompletionSchema,
  }),
]);

export type CompleteIssueSprint = z.infer<typeof completeIssueSprintSchema>;

export const issueSprintParamsSchema = z.object({
  teamKey: z.string(),
  sprintId: z.string().optional(),
});

export const issueSprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().nullable(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  teamId: z.string(),
  createdById: z.string(),
  status: z.enum(issueSprintStatusValues),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const issueSprintListSchema = z.object({
  sprints: z.array(issueSprintSchema),
});

export const issueSprintResponseSchema = z.object({
  sprint: issueSprintSchema,
});

export const issueSprintWithIssuesSchema = z.object({
  sprint: issueSprintSchema,
  issues: z.array(issueSchema),
});

export const issueSprintCompleteContextSchema = z.object({
  sprint: issueSprintSchema,
  plannedSprints: z.array(issueSprintSchema),
  hasUndoneIssues: z.boolean(),
});
