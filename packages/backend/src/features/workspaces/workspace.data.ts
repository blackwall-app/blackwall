import { eq } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";
import type { DbHandle } from "@blackwall/database";
import type { WorkspaceRole } from "@blackwall/database/schema";

export function insertWorkspace(tx: DbHandle, input: { displayName: string; slug: string }) {
  const [workspace] = tx
    .insert(dbSchema.workspace)
    .values({
      displayName: input.displayName,
      slug: input.slug,
    })
    .returning()
    .all();

  return workspace;
}

export async function createWorkspace(
  input: { displayName: string; slug: string },
  handle: DbHandle = db,
) {
  return insertWorkspace(handle, input);
}

export async function getWorkspaceById(id: string, handle: DbHandle = db) {
  const workspace = await handle.query.workspace.findFirst({
    where: {
      id,
    },
  });

  return workspace;
}

export async function getWorkspaceBySlug(slug: string, handle: DbHandle = db) {
  const workspace = await handle.query.workspace.findFirst({
    where: {
      slug,
    },
  });

  return workspace;
}

export function insertWorkspaceMember(
  tx: DbHandle,
  input: {
    userId: string;
    workspaceId: string;
    role?: WorkspaceRole;
  },
) {
  tx.insert(dbSchema.workspaceUser)
    .values({
      userId: input.userId,
      workspaceId: input.workspaceId,
      role: input.role,
    })
    .run();
}

export async function addUserToWorkspace(
  input: {
    userId: string;
    workspaceId: string;
    role?: WorkspaceRole;
  },
  handle: DbHandle = db,
) {
  insertWorkspaceMember(handle, input);
}

export async function isWorkspaceMember(
  input: { userId: string; workspaceId: string },
  handle: DbHandle = db,
) {
  const user = await handle.query.workspaceUser.findFirst({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
    },
  });

  return !!user?.userId;
}

export async function listUserWorkspaces(input: { userId: string }, handle: DbHandle = db) {
  const workspaces = await handle.query.workspace.findMany({
    where: {
      users: {
        id: input.userId,
      },
    },
  });

  return workspaces;
}

export async function updateWorkspace(
  input: { workspaceId: string; displayName: string },
  handle: DbHandle = db,
) {
  const [workspace] = await handle
    .update(dbSchema.workspace)
    .set({ displayName: input.displayName })
    .where(eq(dbSchema.workspace.id, input.workspaceId))
    .returning();

  return workspace;
}

export async function listWorkspaceUsers(input: { workspaceId: string }, handle: DbHandle = db) {
  const users = await handle.query.user.findMany({
    where: {
      workspaces: {
        id: input.workspaceId,
      },
    },
    with: {
      teams: {
        where: {
          workspaceId: input.workspaceId,
        },
      },
    },
  });

  return users;
}

export async function getWorkspaceMember(
  input: { workspaceId: string; userId: string },
  handle: DbHandle = db,
) {
  const member = await handle.query.user.findFirst({
    where: {
      id: input.userId,
      workspaces: {
        id: input.workspaceId,
      },
    },
    with: {
      teams: {
        where: {
          workspaceId: input.workspaceId,
        },
      },
    },
  });

  return member;
}

export async function saveLastWorkspaceForUser(
  input: { userId: string; workspaceId: string },
  handle: DbHandle = db,
) {
  await handle
    .update(dbSchema.user)
    .set({ lastWorkspaceId: input.workspaceId })
    .where(eq(dbSchema.user.id, input.userId));
}

export async function getFirstWorkspaceForUser(input: { userId: string }, handle: DbHandle = db) {
  const workspace = await handle.query.workspace.findFirst({
    where: {
      users: {
        id: input.userId,
      },
    },
  });

  return workspace;
}

export const workspaceData = {
  createWorkspace,
  insertWorkspace,
  getWorkspaceById,
  getWorkspaceBySlug,
  addUserToWorkspace,
  insertWorkspaceMember,
  isWorkspaceMember,
  listUserWorkspaces,
  updateWorkspace,
  listWorkspaceUsers,
  getWorkspaceMember,
  getFirstWorkspaceForUser,
  saveLastWorkspaceForUser,
};
