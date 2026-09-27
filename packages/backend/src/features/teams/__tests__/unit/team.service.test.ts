import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ForbiddenError } from "../../../../lib/errors";
import { teamData } from "../../team.data";
import { teamKeyFromName, teamService } from "../../team.service";

describe("teamService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("derives the team key from the first three characters of the name, without spaces", () => {
    expect(teamKeyFromName("Alpha Space")).toBe("ALP");
    expect(teamKeyFromName("a b cdef")).toBe("ABC");
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
});
