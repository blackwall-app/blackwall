import { workspaceData } from "./workspace.data";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type { User } from "@blackwall/database/schema";

/**
 * Creates a new workspace. Anyone can create a workspace. It's used when signing up.
 * @param input display name and URL slug for the new workspace
 * @returns newly created workspace
 */
async function createWorkspace(input: { displayName: string; slug: string }) {
  return workspaceData.createWorkspace(input);
}

/**
 * Gets a workspace by its slug. Only members of the workspace can access it.
 * @param slug URL slug of the workspace
 * @param userId user id for access check
 * @returns workspace data
 * @throws NotFoundError if workspace not found
 * @throws ForbiddenError if user is not a member
 */
async function getWorkspaceBySlug(slug: string, userId: string) {
  const workspace = await workspaceData.getWorkspaceBySlug(slug);

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  const isMember = await workspaceData.isWorkspaceMember({
    userId,
    workspaceId: workspace.id,
  });

  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the workspace");
  }

  return workspace;
}

/**
 * Adds a user to a workspace. Only used when signing up, existing users should invite other users instead.
 * @param input user id and workspace id
 */
async function UNCHECKED_addUserToWorkspace(input: { userId: string; workspaceId: string }) {
  return workspaceData.addUserToWorkspace(input);
}

/**
 * Adds a user to a workspace. Validates that the actor is a member.
 * @param input actor id, user id, and workspace id
 * @throws ForbiddenError if actor is not a member of the workspace
 */
async function addUserToWorkspace(input: { actorId: string; userId: string; workspaceId: string }) {
  const isMember = await isWorkspaceMember({
    userId: input.actorId,
    workspaceId: input.workspaceId,
  });
  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the workspace");
  }

  await workspaceData.addUserToWorkspace(input);
}

/**
 * Checks if a user is a member of a workspace.
 * @param input user id and workspace id
 * @returns true if the user is a member of the workspace, false otherwise
 */
async function isWorkspaceMember(input: { userId: string; workspaceId: string }) {
  return workspaceData.isWorkspaceMember(input);
}

/**
 * List all workspaces the user belongs to.
 * @param input user id
 * @returns list of workspaces
 */
async function listUserWorkspaces(input: { userId: string }) {
  const workspaces = await workspaceData.listUserWorkspaces(input);

  return workspaces;
}

/**
 * Update a workspace's display name.
 * @param input actor id, workspace id, and new display name
 * @returns updated workspace
 * @throws ForbiddenError if actor is not a member of the workspace
 */
async function updateWorkspace(input: {
  actorId: string;
  workspaceId: string;
  displayName: string;
}) {
  const isMember = await isWorkspaceMember({
    userId: input.actorId,
    workspaceId: input.workspaceId,
  });
  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the workspace");
  }

  return workspaceData.updateWorkspace({
    workspaceId: input.workspaceId,
    displayName: input.displayName,
  });
}

/**
 * List all members of a workspace.
 * @param input actor id and workspace id
 * @returns list of workspace members
 * @throws ForbiddenError if actor is not a member of the workspace
 */
async function listWorkspaceMembers(input: { actorId: string; workspaceId: string }) {
  const isMember = await isWorkspaceMember({
    userId: input.actorId,
    workspaceId: input.workspaceId,
  });
  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the workspace");
  }

  return workspaceData.listWorkspaceUsers({ workspaceId: input.workspaceId });
}

/**
 * Get a specific member of a workspace.
 * @param input actor id, workspace id, and target user id
 * @returns member data or null
 * @throws ForbiddenError if actor is not a member of the workspace
 */
async function getWorkspaceMember(input: { actorId: string; workspaceId: string; userId: string }) {
  const isMember = await isWorkspaceMember({
    userId: input.actorId,
    workspaceId: input.workspaceId,
  });
  if (!isMember) {
    throw new ForbiddenError("Current user is not a member of the workspace");
  }

  return workspaceData.getWorkspaceMember({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
}

/**
 * Get the user's preferred workspace (last accessed or first available).
 * @param input user object with lastWorkspaceId and id
 * @returns preferred workspace or null
 */
async function getPreferredWorkspaceForUser(input: { user: Pick<User, "lastWorkspaceId" | "id"> }) {
  if (input.user.lastWorkspaceId) {
    const workspace = await workspaceData.getWorkspaceById(input.user.lastWorkspaceId);
    if (workspace) {
      return workspace;
    }
  }

  const workspace = await workspaceData.getFirstWorkspaceForUser({
    userId: input.user.id,
  });

  return workspace ?? null;
}

async function saveLastWorkspaceForUser(input: { userId: string; workspaceId: string }) {
  await workspaceData.saveLastWorkspaceForUser(input);
}

export const workspaceService = {
  createWorkspace,
  getWorkspaceBySlug,
  addUserToWorkspace,
  listUserWorkspaces,
  updateWorkspace,
  listWorkspaceMembers,
  getWorkspaceMember,
  isWorkspaceMember,
  UNCHECKED_addUserToWorkspace,
  saveLastWorkspaceForUser,
  getPreferredWorkspaceForUser,
};
