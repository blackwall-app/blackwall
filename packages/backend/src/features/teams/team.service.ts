import type { Workspace } from "@blackwall/database/schema";
import { teamData } from "./team.data";
import { ForbiddenError, NotFoundError } from "../../lib/errors";

/**
 * Create a new team. Anyone can do this operation.
 * @param input name, key and workspace id for the new team
 * @returns the newly created team
 */
async function createTeam(input: { name: string; key: string; workspaceId: string }) {
  return teamData.createTeam(input);
}

/**
 * Create a new team based on an existing workspace.
 * @param input workspace object containing displayName and id
 * @returns the newly created team
 */
async function createTeamBasedOnWorkspace(input: {
  workspace: Pick<Workspace, "displayName" | "id">;
}) {
  const key = input.workspace.displayName.split(" ").join("").slice(0, 3).toUpperCase();
  return teamData.createTeam({
    name: input.workspace.displayName,
    workspaceId: input.workspace.id,
    key,
  });
}

/**
 * Add a user to a team. Permissions aren't checked.
 * @param input team id and user id
 */
async function UNCHECKED_addUserToTeam(input: { teamId: string; userId: string }) {
  return teamData.addUserToTeam(input);
}

/**
 * Add a user to a team. Permissions are checked.
 * @param input team id and user id
 */
async function addUserToTeam(input: { actorId: string; teamId: string; userId: string }) {
  const isMember = await teamData.isTeamMember({
    userId: input.actorId,
    teamId: input.teamId,
  });
  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the team");
  }

  return teamData.addUserToTeam(input);
}

/**
 * Get all teams in a workspace.
 * @param input workspace id
 * @returns list of teams
 */
async function getTeams(input: { workspaceId: string }) {
  return teamData.getTeams(input);
}

/**
 * Get all teams in a workspace that the user is a member of.
 * @param input workspace id and user id
 * @returns list of teams the user belongs to
 */
async function getTeamsForUser(input: { workspaceId: string; userId: string }) {
  return teamData.listUserTeams(input);
}

/**
 * Get a team by its key. Only team members can access it.
 * @param input workspace id, team key, and user id
 * @returns team data
 * @throws NotFoundError if team not found or user is not a member
 */
async function getTeamByKey(input: { workspaceId: string; teamKey: string; userId: string }) {
  const team = await teamData.getTeamForUser(input);
  if (!team) {
    throw new NotFoundError("Team not found or you are not a member");
  }
  return team;
}

/**
 * List all users in a team. Only team members can access this.
 * @param input workspace id, team key, and user id
 * @returns list of team members
 * @throws ForbiddenError if user is not a member of the team
 */
async function listTeamUsers(input: { workspaceId: string; teamKey: string; userId: string }) {
  const isMember = await teamData.getTeamForUser({
    workspaceId: input.workspaceId,
    teamKey: input.teamKey,
    userId: input.userId,
  });
  if (!isMember) {
    throw new ForbiddenError("You are not a member of this team");
  }
  return teamData.listTeamUsers(input);
}

/**
 * Get the user's preferred team in a workspace.
 * @param input workspace id and user id
 * @returns preferred team or null
 */
async function getPreferredTeam(input: { workspaceId: string; userId: string }) {
  return teamData.getPreferredTeamForUser(input);
}

/**
 * List all teams the user belongs to that have active sprints.
 * @param input workspace id and user id
 * @returns list of teams with active sprints
 */
async function listTeamsWithActiveSprints(input: { workspaceId: string; userId: string }) {
  return teamData.listUserTeamsWithActiveSprint(input);
}

export const teamService = {
  createTeam,
  createTeamBasedOnWorkspace,
  addUserToTeam,
  UNCHECKED_addUserToTeam,
  getTeams,
  getTeamsForUser,
  getTeamByKey,
  listTeamUsers,
  getPreferredTeam,
  listTeamsWithActiveSprints,
};
