import { describe, expect, it } from "bun:test";
import { createBoardDnD } from "../../board-dnd";

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function makeIssue(issueKey: string, top: number, height = 40): HTMLElement {
  return {
    dataset: { issueKey },
    getBoundingClientRect: () => makeRect(0, top, 180, height),
  } as unknown as HTMLElement;
}

function makeColumn(left: number, issues: HTMLElement[]): HTMLElement {
  return {
    getBoundingClientRect: () => makeRect(left, 0, 200, 400),
    querySelectorAll: () => issues,
  } as unknown as HTMLElement;
}

describe("board DnD helpers", () => {
  it("calculates the drop index while skipping the dragged issue", () => {
    const dnd = createBoardDnD();

    dnd.setColumnRef(
      "to_do",
      makeColumn(0, [makeIssue("TES-1", 0), makeIssue("TES-2", 50), makeIssue("TES-3", 100)]),
    );

    dnd.setDragState({
      draggedIssueKey: "TES-1",
      initialRect: makeRect(0, 0, 180, 40),
      dragX: 0,
      dragY: 60,
    });

    expect(dnd.calculateDropTarget(0, 0)).toEqual({
      columnId: "to_do",
      index: 1,
    });
  });

  it("falls back to the nearest column when the pointer is between columns", () => {
    const dnd = createBoardDnD();

    dnd.setColumnRef("to_do", makeColumn(0, []));
    dnd.setColumnRef("in_progress", makeColumn(300, []));

    dnd.setDragState({
      draggedIssueKey: "TES-4",
      initialRect: makeRect(0, 0, 100, 40),
      dragX: 220,
      dragY: 0,
    });

    expect(dnd.calculateDropTarget(0, 0)).toEqual({
      columnId: "in_progress",
      index: 0,
    });
  });
});
