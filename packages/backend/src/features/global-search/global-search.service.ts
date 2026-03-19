import { teamData } from "../teams/team.data";
import { globalSearchData } from "./global-search.data";

/**
 * Search for issues and users across the workspace.
 * @param input search term, workspace id, and user id
 * @returns matching issues and users
 */
async function search(input: { searchTerm: string; workspaceId: string; userId: string }) {
  const userTeams = await teamData.listUserTeams({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  const teamIds = userTeams.map((team) => team.id);

  const [issues, users] = await Promise.all([
    globalSearchData.searchIssues({
      searchTerm: input.searchTerm,
      workspaceId: input.workspaceId,
      teamIds,
    }),
    globalSearchData.searchUsers({
      searchTerm: input.searchTerm,
      workspaceId: input.workspaceId,
    }),
  ]);

  return {
    issues: issues.map((issue) => ({ ...issue, type: "issue" as const })),
    users: users.map((user) => ({ ...user, type: "user" as const })),
  };
}

export const globalSearchService = {
  search,
};
