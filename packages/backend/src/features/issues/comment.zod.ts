import { z } from "zod";

export const commentParamsSchema = z.object({
  issueKey: z.string(),
});

export type CommentParams = z.infer<typeof commentParamsSchema>;

export const createCommentSchema = z.object({
  content: z.any(),
});

export type CreateComment = z.infer<typeof createCommentSchema>;

export const deleteCommentParamsSchema = z.object({
  issueKey: z.string(),
  commentId: z.string(),
});

export type DeleteCommentParams = z.infer<typeof deleteCommentParamsSchema>;

export const commentSchema = z.object({
  id: z.string(),
  content: z.any(), // JSONContent
  issueId: z.string(),
  userId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.number().nullable().optional(),
  user: z
    .object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable() })
    .optional(),
});

export const commentResponseSchema = z.object({
  comment: commentSchema,
});
