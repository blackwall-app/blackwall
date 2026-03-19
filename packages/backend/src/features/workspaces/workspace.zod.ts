import { z } from "zod";

export const createWorkspaceSchema = z.object({
  displayName: z.string().min(2).max(30),
  slug: z.string().min(2).max(10),
});

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  displayName: z.string().min(2).max(30),
});

export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string(),
});

export type WorkspaceIdParams = z.infer<typeof workspaceIdParamsSchema>;

export const workspaceSlugParamsSchema = z.object({
  slug: z.string(),
});

export type WorkspaceSlugParams = z.infer<typeof workspaceSlugParamsSchema>;

export const workspaceMemberParamsSchema = z.object({
  slug: z.string(),
  userId: z.string(),
});

export type WorkspaceMemberParams = z.infer<typeof workspaceMemberParamsSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const workspaceListSchema = z.object({
  workspaces: z.array(workspaceSchema),
});

export const workspaceResponseSchema = z.object({
  workspace: workspaceSchema,
});

export const workspaceMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
  role: z.string().optional(),
  joinedAt: z.any().optional(),
});

export const workspaceMemberListSchema = z.object({
  members: z.array(workspaceMemberSchema),
});

export const workspaceMemberResponseSchema = z.object({
  member: workspaceMemberSchema,
});
