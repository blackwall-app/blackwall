import { z } from "zod";

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
});

export const labelSchema = z.object({
  id: z.string(),
  name: z.string(),
  colorKey: z.string(),
  workspaceId: z.string(),
});

export const labelListSchema = z.object({
  labels: z.array(labelSchema),
});

export type CreateLabel = z.infer<typeof createLabelSchema>;
