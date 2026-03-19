import { z } from "zod";

export const globalSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;

export const globalSearchResponseSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      summary: z.string(),
      status: z.string(),
    }),
  ),
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      image: z.string().nullable(),
    }),
  ),
});

export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;
