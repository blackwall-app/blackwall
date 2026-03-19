import { createContext, createEffect, createSignal, onCleanup, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { IssueStatus } from "@blackwall/database/schema";
import { DragGesture } from "@use-gesture/vanilla";
import { createAutoScroller } from "./auto-scroll";

export type DragState = {
  isDragging: boolean;
  draggedIssueKey: string | null;
  dragX: number;
  dragY: number;
  initialRect: DOMRect | null;
  overColumnId: IssueStatus | null;
  overIndex: number;
};

export const initialDragState: DragState = {
  isDragging: false,
  draggedIssueKey: null,
  dragX: 0,
  dragY: 0,
  initialRect: null,
  overColumnId: null,
  overIndex: -1,
};

export function createBoardDnD() {
  const [dragState, setDragState] = createStore<DragState>(initialDragState);
  const columnRefs = new Map<IssueStatus, HTMLElement>();
  const autoScroller = createAutoScroller();

  function setScrollContainerRef(el: HTMLElement) {
    autoScroller.setContainer(el);
  }

  function setColumnRef(id: IssueStatus, el: HTMLElement) {
    columnRefs.set(id, el);
  }

  function getIssueElementsInColumn(columnId: IssueStatus): HTMLElement[] {
    const column = columnRefs.get(columnId);
    if (!column) return [];
    return Array.from(column.querySelectorAll("[data-issue-key]")) as HTMLElement[];
  }

  function calculateDropTarget(
    cursorX: number,
    _cursorY: number,
  ): { columnId: IssueStatus | null; index: number } {
    let closestColumn: IssueStatus | null = null;
    let closestDistance = Infinity;

    const draggedCenterY = dragState.initialRect
      ? dragState.initialRect.top + dragState.initialRect.height / 2 + dragState.dragY
      : _cursorY;

    const draggedCenterX = dragState.initialRect
      ? dragState.initialRect.left + dragState.initialRect.width / 2 + dragState.dragX
      : cursorX;

    for (const [columnId, columnEl] of columnRefs.entries()) {
      const rect = columnEl.getBoundingClientRect();
      if (draggedCenterX >= rect.left && draggedCenterX <= rect.right) {
        closestColumn = columnId;
        break;
      }
      const distance = Math.min(
        Math.abs(draggedCenterX - rect.left),
        Math.abs(draggedCenterX - rect.right),
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestColumn = columnId;
      }
    }

    if (!closestColumn) {
      return { columnId: null, index: -1 };
    }

    const issueElements = getIssueElementsInColumn(closestColumn);
    let targetIndex = 0;
    let foundPosition = false;

    for (let i = 0; i < issueElements.length; i++) {
      const el = issueElements[i];
      if (el.dataset.issueKey === dragState.draggedIssueKey) continue;

      const rect = el.getBoundingClientRect();
      const cardCenterY = rect.top + rect.height / 2;

      if (draggedCenterY < cardCenterY) {
        foundPosition = true;
        break;
      }
      targetIndex++;
    }

    if (!foundPosition) {
      const nonDraggedCount = issueElements.filter(
        (el) => el.dataset.issueKey !== dragState.draggedIssueKey,
      ).length;
      targetIndex = nonDraggedCount;
    }

    return { columnId: closestColumn, index: targetIndex };
  }

  function resetDrag() {
    autoScroller.stop();
    setDragState(
      produce((draft) => {
        draft.isDragging = false;
        draft.draggedIssueKey = null;
        draft.dragX = 0;
        draft.dragY = 0;
        draft.initialRect = null;
        draft.overColumnId = null;
        draft.overIndex = -1;
      }),
    );
  }

  function useDraggable(
    issueKey: string,
    issueStatus: IssueStatus,
    callbacks: {
      onDrop: () => void;
      onClick?: () => void;
    },
  ) {
    const [ref, setRef] = createSignal<HTMLElement>();

    createEffect(() => {
      const el = ref();
      if (!el) return;

      const gesture = new DragGesture(
        el,
        ({ active, movement: [mx, my], first, last, xy: [x, y], tap }) => {
          if (tap) {
            callbacks.onClick?.();
            return;
          }

          if (first) {
            const rect = el.getBoundingClientRect();
            const siblings = getIssueElementsInColumn(issueStatus);
            const initialIndex = siblings.findIndex((s) => s.dataset.issueKey === issueKey);
            setDragState(
              produce((draft) => {
                draft.isDragging = true;
                draft.draggedIssueKey = issueKey;
                draft.dragX = 0;
                draft.dragY = 0;
                draft.initialRect = rect;
                draft.overColumnId = issueStatus;
                draft.overIndex = initialIndex >= 0 ? initialIndex : 0;
              }),
            );
          }

          if (active) {
            autoScroller.updateCursor(x);
            autoScroller.start();
            const dropTarget = calculateDropTarget(x, y);
            setDragState(
              produce((draft) => {
                draft.dragX = mx;
                draft.dragY = my;
                if (dropTarget.columnId) {
                  draft.overColumnId = dropTarget.columnId;
                  draft.overIndex = dropTarget.index;
                }
              }),
            );
          }

          if (last && !tap) {
            autoScroller.stop();
            callbacks.onDrop();
          }
        },
        {
          filterTaps: true,
          delay: 500,
          pointer: {
            touch: true,
          },
        },
      );

      onCleanup(() => gesture.destroy());
    });

    return setRef;
  }

  return {
    dragState,
    setDragState,
    setColumnRef,
    setScrollContainerRef,
    calculateDropTarget,
    useDraggable,
    resetDrag,
  };
}

export type BoardDnDContextType = ReturnType<typeof createBoardDnD> & {
  onDrop: () => void | Promise<void>;
};

export const BoardDnDContext = createContext<BoardDnDContextType>();

export function useBoardDnD() {
  const context = useContext(BoardDnDContext);
  if (!context) {
    throw new Error("useBoardDnD must be used within a BoardDnDContext.Provider");
  }
  return context;
}
