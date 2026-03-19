import type { RowSelectionState } from "@tanstack/solid-table";
import { createSignal, type Accessor } from "solid-js";

export type RowSelectionOptions = {
  enableRowSelection?: boolean;
  enableMultiRowSelection?: boolean;
};

export type RowSelectionResult = {
  rowSelection: Accessor<RowSelectionState>;
  setRowSelection: (
    value: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState),
  ) => void;
  getSelectedRowIds: () => string[];
  clearSelection: () => void;
};

export function createRowSelection(): RowSelectionResult {
  const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});

  const getSelectedRowIds = () => Object.keys(rowSelection()).filter((id) => rowSelection()[id]);

  const clearSelection = () => setRowSelection({});

  return {
    rowSelection,
    setRowSelection,
    getSelectedRowIds,
    clearSelection,
  };
}
