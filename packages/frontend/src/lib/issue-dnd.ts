import type { SerializedIssueSprint, SerializedIssueWithoutDescription } from "@blackwall/database";
import { DragGesture } from "@use-gesture/vanilla";
import { createContext, createEffect, createSignal, onCleanup, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";

export type IssueDragState = {
  isDragging: boolean;
  draggedIssues: SerializedIssueWithoutDescription[];
  cursorX: number;
  cursorY: number;
};

const initialState: IssueDragState = {
  isDragging: false,
  draggedIssues: [],
  cursorX: 0,
  cursorY: 0,
};

export function createIssueDnD(options: {
  sprints: () => SerializedIssueSprint[];
  getSelectedIssues?: () => SerializedIssueWithoutDescription[];
  onDrop?: (issues: SerializedIssueWithoutDescription[], sprint: SerializedIssueSprint) => void;
}) {
  const [dragState, setDragState] = createStore<IssueDragState>(initialState);
  const dropZoneRefs = new Map<string, HTMLElement>();
  let hoveredEl: HTMLElement | null = null;

  function setDropZoneRef(sprintId: string, el: HTMLElement) {
    dropZoneRefs.set(sprintId, el);
  }

  function removeDropZoneRef(sprintId: string) {
    dropZoneRefs.delete(sprintId);
  }

  function hitTest(x: number, y: number): { sprintId: string; el: HTMLElement } | null {
    for (const [sprintId, el] of dropZoneRefs) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { sprintId, el };
      }
    }
    return null;
  }

  function updateHover(x: number, y: number) {
    const hit = hitTest(x, y)?.el ?? null;
    if (hit === hoveredEl) return;
    hoveredEl?.removeAttribute("data-drop-hover");
    hit?.setAttribute("data-drop-hover", "");
    hoveredEl = hit;
  }

  function clearHover() {
    hoveredEl?.removeAttribute("data-drop-hover");
    hoveredEl = null;
  }

  function findDropTarget(x: number, y: number): SerializedIssueSprint | null {
    const result = hitTest(x, y);
    if (!result) return null;
    return options.sprints().find((s) => s.id === result.sprintId) ?? null;
  }

  function resetDrag() {
    clearHover();
    setDragState(
      produce((draft) => {
        draft.isDragging = false;
        draft.draggedIssues = [];
        draft.cursorX = 0;
        draft.cursorY = 0;
      }),
    );
  }

  function useDraggable(issue: SerializedIssueWithoutDescription) {
    const [ref, setRef] = createSignal<HTMLElement>();

    createEffect(() => {
      const el = ref();
      if (!el) return;

      const gesture = new DragGesture(
        el,
        ({ active, xy: [x, y], tap }) => {
          if (tap) return;

          if (active) {
            // If the dragged issue is part of a selection, drag all selected issues
            const selected = options.getSelectedIssues?.() ?? [];
            const isSelected = selected.some((s) => s.id === issue.id);
            const issues = isSelected && selected.length > 1 ? selected : [issue];

            document.body.style.userSelect = "none";
            setDragState(
              produce((draft) => {
                draft.isDragging = true;
                draft.draggedIssues = issues;
                draft.cursorX = x;
                draft.cursorY = y;
              }),
            );
            updateHover(x, y);
            return;
          }

          document.body.style.userSelect = "";
          // Drop
          const target = findDropTarget(x, y);
          if (target && dragState.draggedIssues.length > 0) {
            options.onDrop?.([...dragState.draggedIssues], target);
          }
          resetDrag();
        },
        {
          delay: 500,
          filterTaps: true,
          pointer: { touch: true },
        },
      );

      onCleanup(() => {
        gesture.destroy();
        if (dragState.draggedIssues.some((i) => i.key === issue.key)) {
          document.body.style.userSelect = "";
          resetDrag();
        }
      });
    });

    return setRef;
  }

  return {
    dragState,
    setDropZoneRef,
    removeDropZoneRef,
    useDraggable,
    resetDrag,
    sprints: options.sprints,
  };
}

export type IssueDnDContextType = ReturnType<typeof createIssueDnD>;

export const IssueDnDContext = createContext<IssueDnDContextType>();

export function useIssueDnD() {
  const context = useContext(IssueDnDContext);
  if (!context) {
    throw new Error("useIssueDnD must be used within an IssueDnDContext.Provider");
  }
  return context;
}
