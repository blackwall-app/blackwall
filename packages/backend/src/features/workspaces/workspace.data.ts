import { eq } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";

export async function createWorkspace(input: { displayName: string; slug: string }) {
  const [workspace] = await db
    .insert(dbSchema.workspace)
    .values({
      displayName: input.displayName,
      slug: input.slug,
    })
    .returning();

  return workspace;
}

export async function getWorkspaceById(id: string) {
  const workspace = await db.query.workspace.findFirst({
    where: {
      id,
    },
  });

  return workspace;
}

export async function getWorkspaceBySlug(slug: string) {
  const workspace = await db.query.workspace.findFirst({
    where: {
      slug,
    },
  });

  return workspace;
}

export async function addUserToWorkspace(input: { userId: string; workspaceId: string }) {
  const user = await db
    .insert(dbSchema.workspaceUser)
    .values({
      userId: input.userId,
      workspaceId: input.workspaceId,
    })
    .execute();

  return user;
}

export async function isWorkspaceMember(input: { userId: string; workspaceId: string }) {
  const user = await db.query.workspaceUser.findFirst({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
    },
  });

  return !!user?.userId;
}

export async function listUserWorkspaces(input: { userId: string }) {
  const workspaces = await db.query.workspace.findMany({
    where: {
      users: {
        id: input.userId,
      },
    },
  });

  return workspaces;
}

export async function updateWorkspace(input: { workspaceId: string; displayName: string }) {
  const [workspace] = await db
    .update(dbSchema.workspace)
    .set({ displayName: input.displayName })
    .where(eq(dbSchema.workspace.id, input.workspaceId))
    .returning();

  return workspace;
}

export async function listWorkspaceUsers(input: { workspaceId: string }) {
  const users = await db.query.user.findMany({
    where: {
      workspaces: {
        id: input.workspaceId,
      },
    },
    with: {
      teams: true,
    },
  });

  return users;
}

export async function getWorkspaceMember(input: { workspaceId: string; userId: string }) {
  const member = await db.query.user.findFirst({
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

export async function saveLastWorkspaceForUser(input: { userId: string; workspaceId: string }) {
  await db
    .update(dbSchema.user)
    .set({ lastWorkspaceId: input.workspaceId })
    .where(eq(dbSchema.user.id, input.userId));
}

export async function getFirstWorkspaceForUser(input: { userId: string }) {
  const workspace = await db.query.workspace.findFirst({
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
  getWorkspaceById,
  getWorkspaceBySlug,
  addUserToWorkspace,
  isWorkspaceMember,
  listUserWorkspaces,
  updateWorkspace,
  listWorkspaceUsers,
  getWorkspaceMember,
  getFirstWorkspaceForUser,
  saveLastWorkspaceForUser,
};
