import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(2).max(30),
  key: z.string().min(3).max(5),
  workspaceId: z.string().uuid(),
});

export type CreateTeam = z.infer<typeof createTeamSchema>;

export const teamParamsSchema = z.object({
  teamKey: z.string(),
});

export type TeamParams = z.infer<typeof teamParamsSchema>;

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  workspaceId: z.string(),
  activeSprintId: z.string().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

export const teamListSchema = z.object({
  teams: z.array(teamSchema),
});

export const teamResponseSchema = z.object({
  team: teamSchema.nullable().optional(),
});

export const teamWithSprintSchema = teamSchema.extend({
  activeSprint: z
    .object({
      id: z.string(),
      name: z.string(),
      // add other sprint fields if needed
    })
    .optional(),
});

export const teamWithSprintListSchema = z.object({
  teams: z.array(teamWithSprintSchema),
});

export const teamUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
});

export const teamUserListSchema = z.object({
  users: z.array(teamUserSchema),
});
