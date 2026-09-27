import { db, dbSchema, type DbHandle, type DbTransaction } from "@blackwall/database";
import type { Team } from "@blackwall/database/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * A team taking a key removes that key's alias, so `KEY-12` links point at the new owner.
 */
function claimTeamKey(tx: DbTransaction, input: { workspaceId: string; key: string }) {
  tx.delete(dbSchema.teamKeyAlias)
    .where(
      and(
        eq(dbSchema.teamKeyAlias.workspaceId, input.workspaceId),
        eq(dbSchema.teamKeyAlias.key, input.key),
      ),
    )
    .run();
}

export function insertTeam(
  tx: DbTransaction,
  input: { name: string; key: string; workspaceId: string },
) {
  claimTeamKey(tx, { workspaceId: input.workspaceId, key: input.key });

  const [team] = tx
    .insert(dbSchema.team)
    .values({
      name: input.name,
      key: input.key,
      workspaceId: input.workspaceId,
    })
    .returning()
    .all();

  return team;
}

export function insertTeamMember(tx: DbHandle, input: { userId: string; teamId: string }) {
  tx.insert(dbSchema.userTeam)
    .values({
      userId: input.userId,
      teamId: input.teamId,
    })
    .onConflictDoNothing()
    .run();
}

export async function isTeamMember(input: { userId: string; teamId: string }, handle: DbHandle) {
  const membership = await handle.query.userTeam.findFirst({
    where: {
      userId: input.userId,
      teamId: input.teamId,
    },
  });

  return membership !== undefined;
}

export async function getTeamByKey(
  input: { workspaceId: string; teamKey: string },
  handle: DbHandle,
) {
  return handle.query.team.findFirst({
    where: {
      workspaceId: input.workspaceId,
      key: input.teamKey,
    },
  });
}

export async function getTeamForUser(
  input: {
    workspaceId: string;
    teamKey: string;
    userId: string;
  },
  handle: DbHandle = db,
) {
  const team = await handle.query.team.findFirst({
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

export async function listTeamUsers(
  input: { workspaceId: string; teamKey: string },
  handle: DbHandle = db,
) {
  const team = await handle.query.team.findFirst({
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

export async function listUserTeams(
  input: { workspaceId: string; userId: string },
  handle: DbHandle = db,
) {
  return handle.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
      users: { id: input.userId },
    },
    with: {
      activeSprint: true,
    },
  });
}

export async function listUserTeamsWithActiveSprint(
  input: { workspaceId: string; userId: string },
  handle: DbHandle,
) {
  return handle.query.team.findMany({
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

export async function listTeamsWithCounts(input: { workspaceId: string }, handle: DbHandle) {
  const teams = await handle.query.team.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    with: {
      users: true,
      issues: true,
    },
  });

  return teams.map(({ users, issues, ...team }) => ({
    team,
    usersCount: users.length,
    issuesCount: issues.length,
  }));
}

/**
 * Renaming the key keeps the old one as an alias and moves every issue to the new prefix.
 */
export function updateTeam(
  tx: DbTransaction,
  input: {
    team: Pick<Team, "id" | "key" | "workspaceId">;
    updates: { name?: string | undefined; key?: string | undefined };
  },
) {
  const { team, updates } = input;
  const newKey = updates.key;
  const keyChanged = newKey !== undefined && newKey !== team.key;

  if (keyChanged) {
    claimTeamKey(tx, { workspaceId: team.workspaceId, key: newKey });
  }

  const [updated] = tx
    .update(dbSchema.team)
    .set(updates)
    .where(eq(dbSchema.team.id, team.id))
    .returning()
    .all();

  if (keyChanged) {
    tx.insert(dbSchema.teamKeyAlias)
      .values({
        workspaceId: team.workspaceId,
        key: team.key,
        teamId: team.id,
      })
      .run();

    tx.update(dbSchema.issue)
      .set({ key: sql`${newKey} || '-' || ${dbSchema.issue.keyNumber}` })
      .where(eq(dbSchema.issue.teamId, team.id))
      .run();
  }

  return updated;
}

export async function removeUserFromTeam(
  input: { teamId: string; userId: string },
  handle: DbHandle,
) {
  await handle
    .delete(dbSchema.userTeam)
    .where(
      and(eq(dbSchema.userTeam.teamId, input.teamId), eq(dbSchema.userTeam.userId, input.userId)),
    );
}

export async function listWorkspaceUsersNotInTeam(
  input: { workspaceId: string; teamId: string },
  handle: DbHandle,
) {
  const [teamUsers, workspaceUsers] = await Promise.all([
    handle.query.userTeam.findMany({ where: { teamId: input.teamId } }),
    handle.query.user.findMany({ where: { workspaces: { id: input.workspaceId } } }),
  ]);
  const teamUserIds = new Set(teamUsers.map((u) => u.userId));

  return workspaceUsers.filter((u) => !teamUserIds.has(u.id));
}

export const teamData = {
  insertTeam,
  insertTeamMember,
  isTeamMember,
  getTeamByKey,
  getTeamForUser,
  listTeamUsers,
  listUserTeams,
  listUserTeamsWithActiveSprint,
  listTeamsWithCounts,
  updateTeam,
  removeUserFromTeam,
  listWorkspaceUsersNotInTeam,
};
