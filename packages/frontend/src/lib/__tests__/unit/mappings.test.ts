import { beforeAll, describe, expect, it, mock } from "bun:test";
import { overwriteGetLocale } from "../../../paraglide/runtime.js";

mock.module("lucide-solid/icons/circle", () => ({
  default: () => null,
}));

mock.module("lucide-solid/icons/circle-check", () => ({
  default: () => null,
}));

mock.module("lucide-solid/icons/circle-fading-arrow-up", () => ({
  default: () => null,
}));

beforeAll(() => {
  overwriteGetLocale(() => "en");
});

describe("mapping helpers", () => {
  it("converts mappings to option arrays while preserving key order", async () => {
    const { issueMappings, mappingToOptionArray } = await import("../../mappings");

    const statusOptions = mappingToOptionArray(issueMappings.status);

    expect(statusOptions.map((option) => option.id)).toEqual(["to_do", "in_progress", "done"]);
    expect(statusOptions[0]?.label.length).toBeGreaterThan(0);
    expect(statusOptions[0]?.icon).toBeDefined();
  });
});
