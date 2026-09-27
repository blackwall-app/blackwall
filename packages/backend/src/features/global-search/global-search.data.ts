import type { DbHandle } from "@blackwall/database";

/** Issues in the workspace from teams the user belongs to. */
export async function searchIssues(
  input: {
    searchTerm: string;
    workspaceId: string;
    userId: string;
  },
  handle: DbHandle,
) {
  const searchPattern = `%${input.searchTerm.toLowerCase()}%`;

  const issues = await handle.query.issue.findMany({
    where: {
      workspaceId: input.workspaceId,
      team: { users: { id: input.userId } },
      deletedAt: { isNull: true },
      OR: [{ summary: { like: searchPattern } }, { descriptionText: { like: searchPattern } }],
    },
    limit: 50,
  });

  return issues;
}

export async function searchUsers(
  input: { searchTerm: string; workspaceId: string },
  handle: DbHandle,
) {
  const searchPattern = `%${input.searchTerm.toLowerCase()}%`;

  const users = await handle.query.user.findMany({
    where: {
      workspaces: { id: input.workspaceId },
      name: { like: searchPattern },
    },
    limit: 50,
  });

  return users;
}

export const globalSearchData = {
  searchIssues,
  searchUsers,
};
