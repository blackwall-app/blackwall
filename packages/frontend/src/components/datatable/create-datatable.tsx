import type { AnchorProps } from "@solidjs/router";
import {
  createSolidTable,
  type ColumnDef,
  getCoreRowModel,
  type RowData,
  type Row,
} from "@tanstack/solid-table";
import { createMemo, type Accessor } from "solid-js";
import { LinkFeature } from "./link-feature";
import { type RowSelectionResult } from "./row-selection-feature";

declare module "@tanstack/solid-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    expand?: boolean;
    shrink?: boolean;
    headerClass?: string;
    cellClass?: string;
  }
}

type CreateDataTableProps<TData> = {
  columns: ColumnDef<TData, any>[];
  data: Accessor<TData[]>;
  getLinkProps?: (row: Row<TData>) => AnchorProps;
  rowSelection?: RowSelectionResult;
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  enableMultiRowSelection?: boolean;
  getRowId?: (originalRow: TData, index: number) => string;
};

export function createDataTable<TData>({
  columns,
  data,
  getLinkProps,
  rowSelection,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  getRowId,
}: CreateDataTableProps<TData>) {
  const table = createSolidTable({
    get data() {
      return data();
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getLinkProps,
    _features: [LinkFeature],
    enableRowSelection,
    enableMultiRowSelection,
    getRowId,
    ...(rowSelection
      ? {
          state: {
            get rowSelection() {
              return rowSelection.rowSelection();
            },
          },
          onRowSelectionChange: (updater) => {
            const newState =
              typeof updater === "function" ? updater(rowSelection.rowSelection()) : updater;
            rowSelection.setRowSelection(newState);
          },
        }
      : {}),
  });

  const gridTemplateColumns = createMemo(() => {
    return table
      .getAllLeafColumns()
      .map((col) => {
        const width = col.getSize();
        if (col.columnDef.meta?.expand) {
          return `[${col.id}] minmax(${width}px, 1fr)`;
        }
        if (col.columnDef.meta?.shrink) {
          return `[${col.id}] max-content`;
        }
        return `[${col.id}] ${width}px`;
      })
      .join(" ");
  });

  return {
    table,
    gridTemplateColumns,
  };
}
