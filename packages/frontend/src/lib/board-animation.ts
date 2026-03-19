import type { IssueStatus } from "@blackwall/database/schema";
import { createComputed, createSignal, on } from "solid-js";
import type { DragState } from "./board-dnd";

/**
 * Animates the board items to their new positions.
 */
export function createBoardAnimation(dragState: DragState, statusId: IssueStatus) {
  const [containerEl, setContainerEl] = createSignal<HTMLElement>();
  const positionCache = new Map<string, DOMRect>();
  const activeAnimations = new Map<string, Animation>();

  function capture() {
    const container = containerEl();
    if (!container) return;

    for (const anim of activeAnimations.values()) {
      anim.cancel();
    }
    activeAnimations.clear();

    positionCache.clear();
    const items = container.querySelectorAll<HTMLElement>("[data-issue-key]");
    for (const item of items) {
      item.style.transform = "";
      const rect = item.getBoundingClientRect();
      if (rect.height === 0) continue;
      positionCache.set(item.dataset.issueKey!, rect);
    }
  }

  function play() {
    const container = containerEl();
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>("[data-issue-key]");
    for (const item of items) {
      const key = item.dataset.issueKey!;
      const rect = item.getBoundingClientRect();
      if (rect.height === 0) continue;

      const oldRect = positionCache.get(key);
      if (!oldRect) continue;

      const deltaY = oldRect.top - rect.top;
      if (Math.abs(deltaY) < 1) continue;

      const anim = item.animate(
        [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
        { duration: 150, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
      );
      activeAnimations.set(key, anim);
      anim.onfinish = () => activeAnimations.delete(key);
    }
  }

  function cleanup() {
    for (const anim of activeAnimations.values()) {
      anim.cancel();
    }
    activeAnimations.clear();
  }

  createComputed(
    on(
      () => [dragState.overIndex, dragState.overColumnId, dragState.isDragging] as const,
      ([, overColumnId, isDragging], prev) => {
        if (!isDragging) {
          cleanup();
          return;
        }
        const prevCol = prev?.[1];
        const isRelevant = overColumnId === statusId || prevCol === statusId;
        if (!isRelevant) return;

        capture();
        queueMicrotask(() => play());
      },
      { defer: true },
    ),
  );

  return setContainerEl;
}

/**
 * Animates the drag overlay element to the drop indicator position,
 * then calls `onComplete`. Returns false if no indicator was found
 * (caller should reset immediately).
 */
export function animateDropReturn(
  overlayEl: HTMLElement,
  boardContainer: HTMLElement,
  onComplete: () => void,
): boolean {
  const indicator = boardContainer.querySelector<HTMLElement>("[data-drop-indicator]");
  if (!indicator) return false;

  const indicatorRect = indicator.getBoundingClientRect();
  const overlayRect = overlayEl.getBoundingClientRect();

  const deltaX = indicatorRect.left - overlayRect.left;
  const deltaY = indicatorRect.top - overlayRect.top;

  const anim = overlayEl.animate(
    [{ transform: "translate(0px, 0px)" }, { transform: `translate(${deltaX}px, ${deltaY}px)` }],
    { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
  );

  anim.onfinish = () => onComplete();
  anim.oncancel = () => onComplete();

  return true;
}
