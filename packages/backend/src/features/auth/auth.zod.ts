import { z } from "zod";

export const signupEmailSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(50),
  password: z.string().min(8),
  workspaceDisplayName: z.string().min(2).max(50),
  workspaceUrlSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type SignupEmail = z.infer<typeof signupEmailSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const signupResponseSchema = z.object({
  user: authUserSchema,
  workspace: z.object({
    id: z.string(),
    displayName: z.string(),
    slug: z.string(),
  }),
  team: z.object({
    id: z.string(),
    name: z.string(),
    key: z.string(),
  }),
});
