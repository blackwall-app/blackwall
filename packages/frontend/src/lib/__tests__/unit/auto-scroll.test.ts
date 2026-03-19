import { describe, expect, it } from "bun:test";
import { calculateEdgeScrollDelta } from "../../auto-scroll";

function makeContainer(input: {
  left?: number;
  width?: number;
  scrollLeft?: number;
  scrollWidth?: number;
  clientWidth?: number;
}): HTMLElement {
  const left = input.left ?? 0;
  const width = input.width ?? 400;

  return {
    scrollLeft: input.scrollLeft ?? 0,
    scrollWidth: input.scrollWidth ?? 800,
    clientWidth: input.clientWidth ?? width,
    getBoundingClientRect: () => ({
      left,
      right: left + width,
    }),
  } as unknown as HTMLElement;
}

describe("auto-scroll helpers", () => {
  it("scrolls left when the cursor is near the left edge and there is room to scroll", () => {
    const delta = calculateEdgeScrollDelta(10, makeContainer({ scrollLeft: 50 }));

    expect(delta).toBeLessThan(0);
  });

  it("scrolls right when the cursor is near the right edge and there is room to scroll", () => {
    const delta = calculateEdgeScrollDelta(395, makeContainer({ scrollLeft: 100 }));

    expect(delta).toBeGreaterThan(0);
  });

  it("clamps to zero when already at the left bound or fully scrolled right", () => {
    expect(calculateEdgeScrollDelta(10, makeContainer({ scrollLeft: 0 }))).toBe(0);
    expect(
      calculateEdgeScrollDelta(
        395,
        makeContainer({ scrollLeft: 400, scrollWidth: 800, clientWidth: 400 }),
      ),
    ).toBe(0);
  });
});
