import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef, RowData, Table } from "@tanstack/solid-table";
import { m } from "@/paraglide/messages.js";

export function createSelectionColumn<TData extends RowData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    size: 16,
    meta: { shrink: true },
    header: ({ table }) => (
      <Checkbox
        size="sm"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        aria-label={m.datatable_selection_select_all()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        size="sm"
        visibility="outline"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={(checked) => row.toggleSelected(checked)}
        aria-label={m.datatable_selection_select_row()}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

export function getSelectedRows<TData>(table: Table<TData>): TData[] {
  return table.getSelectedRowModel().rows.map((row) => row.original);
}
