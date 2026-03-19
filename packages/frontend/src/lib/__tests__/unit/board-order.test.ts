import { describe, expect, it } from "bun:test";
import { buildColumnOrder, buildMoveIssueRequest } from "../../board-order";

describe("board order helpers", () => {
  it("builds the full destination column order for a move into an empty column", () => {
    expect(
      buildColumnOrder({
        issueKey: "TES-1",
        targetIndex: 0,
        issuesInTargetColumn: [],
      }),
    ).toEqual(["TES-1"]);
  });

  it("builds previous and next neighbors for a move to the top of a different column", () => {
    expect(
      buildMoveIssueRequest({
        issueKey: "TES-3",
        status: "in_progress",
        targetIndex: 0,
        issuesInTargetColumn: [{ key: "TES-1" }, { key: "TES-2" }],
      }),
    ).toEqual({
      issueKey: "TES-3",
      status: "in_progress",
      previousIssueKey: null,
      nextIssueKey: "TES-1",
      optimisticIssueKeys: ["TES-3", "TES-1", "TES-2"],
    });
  });

  it("skips the dragged issue when moving downward in the same column", () => {
    expect(
      buildMoveIssueRequest({
        issueKey: "TES-1",
        status: "to_do",
        targetIndex: 2,
        issuesInTargetColumn: [{ key: "TES-1" }, { key: "TES-2" }, { key: "TES-3" }],
      }),
    ).toEqual({
      issueKey: "TES-1",
      status: "to_do",
      previousIssueKey: "TES-3",
      nextIssueKey: null,
      optimisticIssueKeys: ["TES-2", "TES-3", "TES-1"],
    });
  });

  it("returns both neighbors for a middle insertion", () => {
    expect(
      buildMoveIssueRequest({
        issueKey: "TES-4",
        status: "done",
        targetIndex: 1,
        issuesInTargetColumn: [{ key: "TES-1" }, { key: "TES-2" }, { key: "TES-3" }],
      }),
    ).toEqual({
      issueKey: "TES-4",
      status: "done",
      previousIssueKey: "TES-1",
      nextIssueKey: "TES-2",
      optimisticIssueKeys: ["TES-1", "TES-4", "TES-2", "TES-3"],
    });
  });

  it("clamps out-of-range indexes to the end of the destination column", () => {
    expect(
      buildMoveIssueRequest({
        issueKey: "TES-9",
        status: "done",
        targetIndex: 99,
        issuesInTargetColumn: [{ key: "TES-7" }, { key: "TES-8" }],
      }),
    ).toEqual({
      issueKey: "TES-9",
      status: "done",
      previousIssueKey: "TES-8",
      nextIssueKey: null,
      optimisticIssueKeys: ["TES-7", "TES-8", "TES-9"],
    });
  });
});
