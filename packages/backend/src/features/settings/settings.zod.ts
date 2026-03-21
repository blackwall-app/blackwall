import { z } from "zod";

export const updateProfileNameSchema = z.object({
  name: z.string().min(2).max(100),
});

export type UpdateProfileName = z.infer<typeof updateProfileNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    revokeOtherSessions: z.boolean().optional(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
  });

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const updateWorkspaceSettingsSchema = z.object({
  displayName: z.string().min(2).max(30).optional(),
});

export type UpdateWorkspaceSettings = z.infer<typeof updateWorkspaceSettingsSchema>;

export const teamKeyParamSchema = z.object({
  teamKey: z.string(),
});

export type TeamKeyParam = z.infer<typeof teamKeyParamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  key: z.string().min(1).max(5).toUpperCase().optional(),
});

export type UpdateTeam = z.infer<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
});

export type AddTeamMember = z.infer<typeof addTeamMemberSchema>;

export const removeTeamMemberParamSchema = z.object({
  teamKey: z.string(),
  userId: z.string(),
});

export type RemoveTeamMemberParam = z.infer<typeof removeTeamMemberParamSchema>;

export const createTeamSettingsSchema = z.object({
  name: z.string().min(1).max(100),
  key: z.string().min(1).max(5).toUpperCase(),
});

export type CreateTeamSettings = z.infer<typeof createTeamSettingsSchema>;

export const updatePreferredThemeSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
});

export type UpdatePreferredTheme = z.infer<typeof updatePreferredThemeSchema>;

export const updatePreferredLocaleSchema = z.object({
  locale: z.enum(["en", "pl"]).nullable(),
});

export type UpdatePreferredLocale = z.infer<typeof updatePreferredLocaleSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  preferredTheme: z.enum(["system", "light", "dark"]).nullable().optional(),
  preferredLocale: z.enum(["en", "pl"]).nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const workspaceSettingsSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  slug: z.string(),
  imageUrl: z.string().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const teamSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  workspaceId: z.string(),
  activeSprintId: z.string().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const teamListSchema = z.object({
  teams: z.array(
    teamSettingsSchema.extend({ _count: z.object({ members: z.number() }).optional() }),
  ),
});

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
});

export const teamWithMembersSchema = z.object({
  team: teamSettingsSchema,
  teamMembers: z.array(teamMemberSchema),
});

export const userListSchema = z.object({
  users: z.array(teamMemberSchema),
});

export const profileResponseSchema = z.object({
  profile: userProfileSchema,
});

export const workspaceResponseSchema = z.object({
  workspace: workspaceSettingsSchema,
});

export const teamResponseSchema = z.object({
  team: teamSettingsSchema,
});
