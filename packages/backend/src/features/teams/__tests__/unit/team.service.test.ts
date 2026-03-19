import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ForbiddenError, NotFoundError } from "../../../../lib/errors";
import { teamData } from "../../team.data";
import { teamService } from "../../team.service";

describe("teamService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("derives the team key from the first three uppercase letters of the workspace name", async () => {
    const createSpy = spyOn(teamData, "createTeam").mockResolvedValue({
      id: "team-1",
      name: "Alpha Space",
      key: "ALP",
      workspaceId: "ws-1",
    } as any);

    await teamService.createTeamBasedOnWorkspace({
      workspace: { displayName: "Alpha Space", id: "ws-1" },
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ALP", name: "Alpha Space" }),
    );
  });

  it("throws ForbiddenError when the actor is not a team member", async () => {
    spyOn(teamData, "isTeamMember").mockResolvedValue(false);

    let error: unknown;
    try {
      await teamService.addUserToTeam({
        actorId: "outsider",
        teamId: "team-1",
        userId: "target",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when a non-member requests a team", async () => {
    spyOn(teamData, "getTeamForUser").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await teamService.getTeamByKey({
        workspaceId: "ws-1",
        teamKey: "TES",
        userId: "outsider",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("throws ForbiddenError when a non-member tries to list team users", async () => {
    spyOn(teamData, "getTeamForUser").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await teamService.listTeamUsers({
        workspaceId: "ws-1",
        teamKey: "TES",
        userId: "outsider",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("returns only teams with an active sprint for the user", async () => {
    spyOn(teamData, "listUserTeams").mockResolvedValue([
      { id: "team-1", activeSprintId: "sprint-1" },
      { id: "team-2", activeSprintId: null },
    ] as any);

    const teams = await teamService.listTeamsWithActiveSprints({
      workspaceId: "ws-1",
      userId: "user-1",
    });

    expect(teams.map((t) => t.id)).toEqual(["team-1"]);
  });
});
