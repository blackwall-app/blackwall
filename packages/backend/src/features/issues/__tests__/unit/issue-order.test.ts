import "../../../../test/env.test";
import { describe, expect, it } from "bun:test";
import { ORDER_GAP, calculateMovedIssueOrder } from "../../issue-order";

describe("issue order helpers", () => {
  it("places the first issue in an empty lane at the default gap", () => {
    expect(
      calculateMovedIssueOrder({
        previousOrder: null,
        nextOrder: null,
      }),
    ).toBe(ORDER_GAP);
  });

  it("places an issue between its neighbors using the midpoint", () => {
    expect(
      calculateMovedIssueOrder({
        previousOrder: ORDER_GAP,
        nextOrder: ORDER_GAP * 3,
      }),
    ).toBe(ORDER_GAP * 2);
  });

  it("places an issue before the next anchor when dropping at the top", () => {
    expect(
      calculateMovedIssueOrder({
        previousOrder: null,
        nextOrder: ORDER_GAP,
      }),
    ).toBe(0);
  });

  it("returns null when there is no room between neighbors", () => {
    expect(
      calculateMovedIssueOrder({
        previousOrder: 10,
        nextOrder: 11,
      }),
    ).toBeNull();
  });
});
