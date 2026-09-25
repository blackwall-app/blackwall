import { db, dbSchema, type DbTransaction } from "@blackwall/database";
import { and, eq, sql } from "drizzle-orm";
import { ErrorCode } from "@blackwall/shared";
import { ConflictError, isSqliteUniqueConstraintError } from "../../lib/errors";

/**
 * A team taking a key removes that key's alias, so `KEY-12` links point at the new owner.
 */
async function claimTeamKey(tx: DbTransaction, input: { workspaceId: string; key: string }) {
  await tx
    .delete(dbSchema.teamKeyAlias)
    .where(
      and(
        eq(dbSchema.teamKeyAlias.workspaceId, input.workspaceId),
        eq(dbSchema.teamKeyAlias.key, input.key),
      ),
    );
}

export async function createTeam(input: { name: string; key: string; workspaceId: string }) {
  try {
    return await db.transaction(async (tx) => {
      await claimTeamKey(tx, { workspaceId: input.workspaceId, key: input.key });

      const [team] = await tx
        .insert(dbSchema.team)
        .values({
          name: input.name,
          key: input.key,
          workspaceId: input.workspaceId,
        })
        .returning();

      return team;
    });
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      throw new ConflictError(
        "Team key already exists in this workspace",
        ErrorCode.TEAM_KEY_ALREADY_EXISTS,
      );
    }

    throw error;
  }
}

export async function addUserToTeam(input: { userId: string; teamId: string }) {
  await db.insert(dbSchema.userTeam).values({
    userId: input.userId,
    teamId: input.teamId,
  });
}

export async function isTeamMember(input: { userId: string; teamId: string }) {
  const membership = await db.query.userTeam.findFirst({
    where: {
      userId: input.userId,
      teamId: input.teamId,
    },
  });

  return membership !== undefined;
}

export async function getTeams(input: { workspaceId: string }) {
  return db.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
  });
}

export async function getTeamByKey(input: { workspaceId: string; teamKey: string }) {
  return db.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
    },
  });
}

export async function getTeamForUser(input: {
  workspaceId: string;
  teamKey: string;
  userId: string;
}) {
  const team = await db.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
      users: { id: input.userId },
    },
    with: {
      activeSprint: true,
    },
  });

  return team;
}

export async function listTeamUsers(input: { workspaceId: string; teamKey: string }) {
  const team = await db.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
    },
    with: {
      users: true,
    },
  });

  return team?.users.filter((u) => !!u) ?? [];
}

export async function getPreferredTeamForUser(input: { workspaceId: string; userId: string }) {
  const [user, allUserTeams] = await Promise.all([
    db.query.user.findFirst({ where: { id: input.userId } }),
    db.query.team.findMany({
      where: {
        workspaceId: input.workspaceId,
        users: { id: input.userId },
      },
    }),
  ]);

  if (allUserTeams.length === 0) {
    return null;
  }

  if (user?.lastTeamId) {
    const lastTeam = allUserTeams.find((team) => team.id === user.lastTeamId);
    if (lastTeam) return lastTeam;
  }

  return allUserTeams[0];
}

export async function listUserTeams(input: { workspaceId: string; userId: string }) {
  return db.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
      users: { id: input.userId },
    },
    with: {
      activeSprint: true,
    },
  });
}

export async function listUserTeamsWithActiveSprint(input: {
  workspaceId: string;
  userId: string;
}) {
  return db.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
      users: { id: input.userId },
      activeSprint: true,
    },
    with: {
      activeSprint: true,
    },
  });
}

export async function listTeamsWithCounts(input: { workspaceId: string }) {
  const teams = await db.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    with: {
      users: true,
      issues: true,
    },
  });

  return teams.map((team) => ({
    team: {
      id: team.id,
      name: team.name,
      key: team.key,
      avatar: team.avatar,
      createdAt: team.createdAt,
      workspaceId: team.workspaceId,
    },
    usersCount: team.users?.length ?? 0,
    issuesCount: team.issues?.length ?? 0,
  }));
}

export async function updateTeam(input: {
  workspaceId: string;
  teamKey: string;
  updates: { name?: string; key?: string };
}) {
  const team = await db.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
    },
  });

  if (!team) {
    return null;
  }

  const newKey = input.updates.key;
  const keyChanged = newKey !== undefined && newKey !== team.key;

  try {
    return await db.transaction(async (tx) => {
      if (keyChanged) {
        await claimTeamKey(tx, { workspaceId: input.workspaceId, key: newKey });
      }

      const [updated] = await tx
        .update(dbSchema.team)
        .set(input.updates)
        .where(eq(dbSchema.team.id, team.id))
        .returning();

      if (keyChanged) {
        // Keep the old key resolvable, then move every issue to the new prefix.
        await tx.insert(dbSchema.teamKeyAlias).values({
          workspaceId: input.workspaceId,
          key: team.key,
          teamId: team.id,
        });

        await tx
          .update(dbSchema.issue)
          .set({ key: sql`${newKey} || '-' || ${dbSchema.issue.keyNumber}` })
          .where(eq(dbSchema.issue.teamId, team.id));
      }

      return updated;
    });
  } catch (error) {
    if (isSqliteUniqueConstraintError(error)) {
      throw new ConflictError(
        "Team key already exists in this workspace",
        ErrorCode.TEAM_KEY_ALREADY_EXISTS,
      );
    }

    throw error;
  }
}

export async function removeUserFromTeam(input: { teamId: string; userId: string }) {
  await db
    .delete(dbSchema.userTeam)
    .where(
      and(eq(dbSchema.userTeam.teamId, input.teamId), eq(dbSchema.userTeam.userId, input.userId)),
    );
}

export async function listWorkspaceUsersNotInTeam(input: { workspaceId: string; teamKey: string }) {
  const team = await db.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
    },
    with: {
      users: true,
    },
  });

  if (!team) {
    return [];
  }

  const teamUserIds = new Set(team.users?.map((u) => u.id) ?? []);

  const workspaceUsers = await db.query.user.findMany({
    where: {
      workspaces: { id: input.workspaceId },
    },
  });

  return workspaceUsers.filter((u) => !teamUserIds.has(u.id));
}

export const teamData = {
  createTeam,
  addUserToTeam,
  isTeamMember,
  getTeams,
  getTeamByKey,
  getTeamForUser,
  listTeamUsers,
  getPreferredTeamForUser,
  listUserTeams,
  listUserTeamsWithActiveSprint,
  listTeamsWithCounts,
  updateTeam,
  removeUserFromTeam,
  listWorkspaceUsersNotInTeam,
};
