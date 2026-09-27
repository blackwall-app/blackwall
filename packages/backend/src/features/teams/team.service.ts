import { ErrorCode } from "@blackwall/shared";
import { teamData } from "./team.data";
import { ForbiddenError } from "../../lib/errors";

/**
 * Create a new team. Anyone can do this operation.
 * @param input name, key and workspace id for the new team
 * @returns the newly created team
 */
async function createTeam(input: { name: string; key: string; workspaceId: string }) {
  return teamData.createTeam(input);
}

/**
 * Derive a team key from a name: its first three non-space characters, uppercased.
 * @param name team or workspace display name
 * @returns team key
 */
export function teamKeyFromName(name: string) {
  return name.split(" ").join("").slice(0, 3).toUpperCase();
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
    throw new ForbiddenError("Current user is not a member of the team", ErrorCode.NOT_TEAM_MEMBER);
  }

  return teamData.addUserToTeam(input);
}

export const teamService = {
  createTeam,
  addUserToTeam,
  UNCHECKED_addUserToTeam,
};
