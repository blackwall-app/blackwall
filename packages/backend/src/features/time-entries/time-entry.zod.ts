import { z } from "zod";

export const createTimeEntrySchema = z.object({
  duration: z.number().int().positive(),
  description: z.string().optional(),
});

export const timeEntrySchema = z.object({
  id: z.string(),
  issueId: z.string(),
  userId: z.string(),
  duration: z.number(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(), // Drizzle usually handles dates as strings or Date objects, keeping it loose for now or assuming string from JSON
  updatedAt: z.string().optional(),
});

export const timeEntryWithUserSchema = timeEntrySchema.extend({
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }),
});

export const timeEntryListSchema = z.object({
  entries: z.array(timeEntryWithUserSchema),
});

export const timeEntryTotalSchema = z.object({
  totalMinutes: z.number(),
});

export type CreateTimeEntry = z.infer<typeof createTimeEntrySchema>;
