import { describe, expect, test } from "bun:test";
import {
  changePasswordSchema,
  createTeamSettingsSchema,
  updateTeamSchema,
} from "../../settings.zod";

describe("settings zod schemas", () => {
  test.each([
    {
      name: "accepts a valid password change",
      input: {
        currentPassword: "password123",
        newPassword: "new-password123",
      },
      success: true,
    },
    {
      name: "rejects reusing the current password",
      input: {
        currentPassword: "password123",
        newPassword: "password123",
      },
      success: false,
    },
  ])("$name", ({ input, success }) => {
    const result = changePasswordSchema.safeParse(input);

    expect(result.success).toBe(success);
    if (!success) {
      expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
    }
  });

  test.each([
    {
      name: "uppercases keys on team creation",
      schema: createTeamSettingsSchema,
      input: {
        name: "Platform",
        key: "plat",
      },
      expectedKey: "PLAT",
    },
    {
      name: "uppercases keys on partial team updates",
      schema: updateTeamSchema,
      input: {
        key: "ops",
      },
      expectedKey: "OPS",
    },
  ])("$name", ({ schema, input, expectedKey }) => {
    const result = schema.parse(input);

    expect(result.key).toBe(expectedKey);
  });
});
