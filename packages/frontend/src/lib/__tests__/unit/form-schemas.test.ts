import { beforeAll, describe, expect, it } from "bun:test";
import type { StandardSchema } from "effect";
import { overwriteGetLocale } from "../../../paraglide/runtime.js";
import {
  changePasswordFormSchema,
  completeSprintFormSchema,
  createIssueFormSchema,
  inviteFormSchema,
  sprintFormSchema,
} from "../../form-schemas";

beforeAll(() => {
  overwriteGetLocale(() => "en");
});

const issuesOf = (schema: StandardSchema.StandardSchemaV1, value: unknown) => {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error("Expected synchronous validation");
  return (result.issues ?? []).map((issue) => ({
    path: issue.path?.map(String) ?? [],
    message: issue.message,
  }));
};

describe("form schemas", () => {
  it("accepts valid values", () => {
    expect(issuesOf(inviteFormSchema(), { email: "jane@example.com" })).toEqual([]);
  });

  it("reports localized field messages", () => {
    expect(issuesOf(inviteFormSchema(), { email: "" })).toEqual([
      { path: ["email"], message: "Email is required" },
    ]);
    expect(issuesOf(inviteFormSchema(), { email: "nope" })).toEqual([
      { path: ["email"], message: "Please enter a valid email address" },
    ]);
  });

  it("reports cross-field checks on the target field", () => {
    expect(
      issuesOf(changePasswordFormSchema(), {
        currentPassword: "password1",
        newPassword: "password2",
        confirmPassword: "password3",
      }),
    ).toEqual([{ path: ["confirmPassword"], message: "Passwords do not match" }]);

    expect(
      issuesOf(sprintFormSchema(), {
        name: "Sprint",
        goal: null,
        startDate: "2026-02-10",
        endDate: "2026-02-01",
      }).map((issue) => issue.path),
    ).toEqual([["endDate"]]);
  });

  it("requires a target for the chosen way to complete a sprint", () => {
    const base = {
      targetSprintId: null,
      newSprintName: " ",
      newSprintStartDate: "2026-02-10",
      newSprintEndDate: "2026-02-01",
    };

    expect(
      issuesOf(completeSprintFormSchema(), { ...base, onUndoneIssues: "moveToBacklog" }),
    ).toEqual([]);
    expect(
      issuesOf(completeSprintFormSchema(), { ...base, onUndoneIssues: "moveToPlannedSprint" }),
    ).toEqual([{ path: ["targetSprintId"], message: "Choose a planned sprint" }]);
    expect(
      issuesOf(completeSprintFormSchema(), { ...base, onUndoneIssues: "moveToNewSprint" }).map(
        (issue) => issue.path,
      ),
    ).toEqual([["newSprintName"], ["newSprintEndDate"]]);
  });

  it("requires an issue description", () => {
    expect(
      issuesOf(createIssueFormSchema(), {
        teamKey: "TES",
        summary: "Summary",
        status: "to_do",
        description: undefined,
        assignedToId: null,
        sprintId: null,
      }).map((issue) => issue.path),
    ).toEqual([["description"]]);
  });
});
