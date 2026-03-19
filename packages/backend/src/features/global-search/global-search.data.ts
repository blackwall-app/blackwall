import { db } from "@blackwall/database";

export async function searchIssues(input: {
  searchTerm: string;
  workspaceId: string;
  teamIds: string[];
}) {
  if (input.teamIds.length === 0) {
    return [];
  }

  const searchPattern = `%${input.searchTerm.toLowerCase()}%`;

  const issues = await db.query.issue.findMany({
    where: {
      workspaceId: input.workspaceId,
      teamId: { in: input.teamIds },
      OR: [{ summary: { like: searchPattern } }, { description: { like: searchPattern } }],
    },
    limit: 50,
  });

  return issues;
}

export async function searchUsers(input: { searchTerm: string; workspaceId: string }) {
  const searchPattern = `%${input.searchTerm.toLowerCase()}%`;

  const users = await db.query.user.findMany({
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
