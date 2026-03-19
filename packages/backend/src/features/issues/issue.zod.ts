import { z } from "zod";
import { issueStatusValues, issuePriorityValues } from "@blackwall/database/schema";

export const listIssuesQuerySchema = z.object({
  teamKey: z.string(),
  statusFilters: z
    .union([z.array(z.enum(issueStatusValues)), z.enum(issueStatusValues)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  onlyOnActiveSprint: z.coerce.boolean().optional(),
  withoutSprint: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional().default(50),
  pagination: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val !== "false"),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

export const createIssueSchema = z.object({
  teamKey: z.string(),
  issue: z.object({
    summary: z.string().min(1),
    description: z.any(),
    status: z.enum(issueStatusValues).optional().default("to_do"),
    assignedToId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
  }),
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

export const issueParamsSchema = z.object({
  issueKey: z.string(),
});

export type IssueParams = z.infer<typeof issueParamsSchema>;

export const updateIssueSchema = z.object({
  summary: z.string().min(1).optional(),
  description: z.any().optional(),
  status: z.enum(issueStatusValues).optional(),
  priority: z.enum(issuePriorityValues).optional(),
  assignedToId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  estimationPoints: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().optional(),
});

export type UpdateIssue = z.infer<typeof updateIssueSchema>;

export const bulkUpdateIssuesSchema = z.object({
  issueIds: z.array(z.string()),
  updates: z.object({
    status: z.enum(issueStatusValues).optional(),
    priority: z.enum(issuePriorityValues).optional(),
    assignedToId: z.string().nullable().optional(),
    sprintId: z.string().nullable().optional(),
    estimationPoints: z.number().int().positive().nullable().optional(),
  }),
});

export type BulkUpdateIssues = z.infer<typeof bulkUpdateIssuesSchema>;

export const bulkDeleteIssuesSchema = z.object({
  issueIds: z.array(z.string()),
});

export type BulkDeleteIssues = z.infer<typeof bulkDeleteIssuesSchema>;

export const moveIssueSchema = z
  .object({
    issueKey: z.string(),
    status: z.enum(issueStatusValues),
    previousIssueKey: z.string().nullable().optional(),
    nextIssueKey: z.string().nullable().optional(),
  })
  .refine((value) => value.issueKey !== value.previousIssueKey, {
    message: "Moved issue cannot also be the previous issue",
    path: ["previousIssueKey"],
  })
  .refine((value) => value.issueKey !== value.nextIssueKey, {
    message: "Moved issue cannot also be the next issue",
    path: ["nextIssueKey"],
  })
  .refine(
    (value) =>
      !(
        value.previousIssueKey &&
        value.nextIssueKey &&
        value.previousIssueKey === value.nextIssueKey
      ),
    {
      message: "Previous and next issues must be different",
      path: ["nextIssueKey"],
    },
  );

export type MoveIssue = z.infer<typeof moveIssueSchema>;

// Response Schemas
export const issueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  description: z.any().nullable().optional(),
  status: z.enum(issueStatusValues),
  priority: z.enum(issuePriorityValues),
  teamId: z.string(),
  createdById: z.string(),
  assignedToId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  estimationPoints: z.number().nullable().optional(),
  sortOrder: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.number().nullable().optional(),
  // Add simplified relations if needed, often full objects are returned
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }).optional(),
});

export const issueListSchema = z.object({
  issues: z.array(issueSchema),
  nextCursor: z.string().nullable(),
});

export const issueResponseSchema = z.object({
  issue: issueSchema,
});
