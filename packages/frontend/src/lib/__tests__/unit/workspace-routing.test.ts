import { describe, expect, it } from "bun:test";
import { shouldRedirectTeamlessWorkspace } from "../../workspace-routing";

describe("shouldRedirectTeamlessWorkspace", () => {
  it("returns true for subpages inside a workspace without teams", () => {
    expect(
      shouldRedirectTeamlessWorkspace({
        pathname: "/acme/my-issues",
        workspaceSlug: "acme",
        teamsCount: 0,
      }),
    ).toBe(true);
  });

  it("returns false for the workspace root without teams", () => {
    expect(
      shouldRedirectTeamlessWorkspace({
        pathname: "/acme",
        workspaceSlug: "acme",
        teamsCount: 0,
      }),
    ).toBe(false);
  });

  it("returns false while transitioning to a different workspace", () => {
    expect(
      shouldRedirectTeamlessWorkspace({
        pathname: "/other/my-issues",
        workspaceSlug: "acme",
        teamsCount: 0,
      }),
    ).toBe(false);
  });

  it("returns false when the workspace has teams", () => {
    expect(
      shouldRedirectTeamlessWorkspace({
        pathname: "/acme/my-issues",
        workspaceSlug: "acme",
        teamsCount: 2,
      }),
    ).toBe(false);
  });
});
