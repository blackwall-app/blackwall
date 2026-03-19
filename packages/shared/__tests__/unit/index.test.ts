import { describe, expect, test } from "bun:test";
import { createColorFromString, possibleColors } from "../../index";

describe("shared color helpers", () => {
  test.each(["Alice", "Backend Team", "", "zażółć"])("returns a known color for %p", (input) => {
    expect(possibleColors).toContain(createColorFromString(input));
  });

  test("returns the same color for the same input", () => {
    expect(createColorFromString("Deterministic")).toBe(createColorFromString("Deterministic"));
  });
});
