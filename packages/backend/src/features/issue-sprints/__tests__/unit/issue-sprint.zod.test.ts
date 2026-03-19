import { describe, expect, test } from "bun:test";
import { completeIssueSprintSchema, createIssueSprintSchema } from "../../issue-sprint.zod";

describe("issue-sprint zod schemas", () => {
  test.each([
    {
      name: "accepts equal start and end dates",
      input: {
        name: "Sprint 1",
        goal: null,
        startDate: "2026-03-10",
        endDate: "2026-03-10",
      },
      success: true,
    },
    {
      name: "rejects end dates before the start date",
      input: {
        name: "Sprint 1",
        goal: null,
        startDate: "2026-03-11",
        endDate: "2026-03-10",
      },
      success: false,
    },
  ])("$name", ({ input, success }) => {
    const result = createIssueSprintSchema.safeParse(input);

    expect(result.success).toBe(success);
    if (!success) {
      expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
      expect(result.error?.issues[0]?.message).toBe("End date must be on or after start date");
    }
  });

  test.each([
    {
      name: "moveToBacklog branch",
      input: { onUndoneIssues: "moveToBacklog" },
      success: true,
    },
    {
      name: "moveToPlannedSprint branch",
      input: { onUndoneIssues: "moveToPlannedSprint", targetSprintId: "sprint-1" },
      success: true,
    },
    {
      name: "moveToNewSprint branch with valid dates",
      input: {
        onUndoneIssues: "moveToNewSprint",
        newSprint: {
          name: "Next sprint",
          startDate: "2026-03-15",
          endDate: "2026-03-20",
        },
      },
      success: true,
    },
    {
      name: "moveToNewSprint branch rejects invalid date ranges",
      input: {
        onUndoneIssues: "moveToNewSprint",
        newSprint: {
          name: "Next sprint",
          startDate: "2026-03-21",
          endDate: "2026-03-20",
        },
      },
      success: false,
    },
  ])("$name", ({ input, success }) => {
    const result = completeIssueSprintSchema.safeParse(input);

    expect(result.success).toBe(success);
    if (!success) {
      expect(result.error?.issues[0]?.path).toEqual(["newSprint", "endDate"]);
    }
  });
});
