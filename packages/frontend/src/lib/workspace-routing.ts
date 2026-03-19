export function shouldRedirectTeamlessWorkspace(input: {
  pathname: string;
  workspaceSlug: string;
  teamsCount: number;
}) {
  if (input.teamsCount > 0) {
    return false;
  }

  const workspaceRoot = `/${input.workspaceSlug}`;
  const isInsideCurrentWorkspace =
    input.pathname === workspaceRoot || input.pathname.startsWith(`${workspaceRoot}/`);

  return isInsideCurrentWorkspace && input.pathname !== workspaceRoot;
}
