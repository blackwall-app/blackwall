import { describe, expect, it } from "bun:test";
import { teamKeyFromName } from "../../team-key";

describe("teamKeyFromName", () => {
  it("derives the team key from the first three characters of the name, without spaces", () => {
    expect(teamKeyFromName("Alpha Space")).toBe("ALP");
    expect(teamKeyFromName("a b cdef")).toBe("ABC");
  });
});
