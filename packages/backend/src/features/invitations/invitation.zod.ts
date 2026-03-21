import * as z from "zod";

export const createInvitationSchema = z.object({
  email: z.string().email(),
});

export const invitationTokenParamsSchema = z.object({
  token: z.string().min(1),
});

export const registerAndAcceptInvitationSchema = z.object({
  name: z.string().min(2),
  password: z.string().min(8),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type RegisterAndAcceptInvitationInput = z.infer<typeof registerAndAcceptInvitationSchema>;

export const invitationResponseSchema = z.object({
  message: z.string(),
  invitation: z.object({
    id: z.string(),
    email: z.string(),
    workspaceId: z.string(),
    inviterId: z.string(),
    token: z.string(),
    expiresAt: z.any(), // Date or string
  }),
  invitationUrl: z.string(),
});

export const publicInvitationResponseSchema = z.object({
  invitation: z.object({
    email: z.string(),
    isMember: z.boolean(),
    workspace: z.object({
      displayName: z.string(),
      slug: z.string(),
    }),
  }),
});

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
  }),
  workspaceSlug: z.string(),
});

export const acceptInvitationResponseSchema = z.object({
  message: z.string(),
  workspaceSlug: z.string(),
});
