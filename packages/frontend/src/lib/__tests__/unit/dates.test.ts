import { beforeAll, describe, expect, it } from "bun:test";
import { overwriteGetLocale } from "../../../paraglide/runtime.js";

beforeAll(() => {
  overwriteGetLocale(() => "en");
});

describe("date helpers", () => {
  it("omits the year for dates in the current year and includes it for older dates", async () => {
    const { formatDateShort } = await import("../../dates");

    const currentYear = new Date().getFullYear();
    const currentYearDate = formatDateShort(new Date(`${currentYear}-03-08T12:00:00.000Z`));
    const previousYearDate = formatDateShort(new Date(`${currentYear - 1}-03-08T12:00:00.000Z`));

    expect(currentYearDate).not.toContain(String(currentYear - 1).slice(-2));
    expect(previousYearDate).toContain(String(currentYear - 1).slice(-2));
  });

  it("formats relative times for both Date and string inputs", async () => {
    const { formatRelative } = await import("../../dates");

    const baseDate = new Date("2026-03-08T12:00:00.000Z");

    expect(formatRelative(new Date("2026-03-08T15:00:00.000Z"), baseDate)).toBe("in 3 hours");
    expect(formatRelative("2026-03-06T12:00:00.000Z", baseDate)).toBe("2 days ago");
  });
});
