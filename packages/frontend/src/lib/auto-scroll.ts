const EDGE_THRESHOLD = 80;
const MAX_SCROLL_SPEED = 20;

export function calculateEdgeScrollDelta(cursorX: number, container: HTMLElement): number {
  const rect = container.getBoundingClientRect();
  const distFromLeft = cursorX - rect.left;
  const distFromRight = rect.right - cursorX;

  if (distFromLeft < EDGE_THRESHOLD && container.scrollLeft > 0) {
    return -MAX_SCROLL_SPEED * (1 - distFromLeft / EDGE_THRESHOLD);
  }

  if (distFromRight < EDGE_THRESHOLD) {
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (container.scrollLeft < maxScroll) {
      return MAX_SCROLL_SPEED * (1 - distFromRight / EDGE_THRESHOLD);
    }
  }

  return 0;
}

export function createAutoScroller() {
  let container: HTMLElement | null = null;
  let rafId: number | null = null;
  let cursorX = 0;

  function setContainer(el: HTMLElement) {
    container = el;
  }

  function updateCursor(x: number) {
    cursorX = x;
  }

  function start() {
    if (rafId !== null) return;

    function tick() {
      if (!container) {
        rafId = null;
        return;
      }

      const delta = calculateEdgeScrollDelta(cursorX, container);
      if (delta !== 0) {
        container.scrollLeft += delta;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return { setContainer, updateCursor, start, stop };
}
