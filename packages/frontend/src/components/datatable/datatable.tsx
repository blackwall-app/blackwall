import { flexRender, type Row } from "@tanstack/solid-table";
import {
  DataTableGrid,
  DataTableCell,
  DataTableRoot,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableLinkRow,
} from "./datatable-ui";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ScrollContainer } from "../custom-ui/scroll-area";
import type { createDataTable } from "./create-datatable";
import { useIssueDnD } from "@/lib/issue-dnd";
import type { SerializedIssue } from "@blackwall/database";

interface DataTableProps<TData> extends ReturnType<typeof createDataTable<TData>> {
  issueDrag?: boolean;
  onLoadMore?: () => void | Promise<void>;
  hasMore?: boolean;
}

export function DataTable<TData>(props: DataTableProps<TData>) {
  return (
    <DataTableRoot>
      <DataTableHeaders {...props} />

      <ScrollContainer>
        <DataTableBody {...props} />
      </ScrollContainer>
    </DataTableRoot>
  );
}

export function BaseIssueDataTable<TData>(props: DataTableProps<TData>) {
  let sentinelRef: HTMLDivElement | undefined;
  const [isNearBottom, setIsNearBottom] = createSignal(false);
  let loading = false;

  const maybeLoadMore = () => {
    if (loading || !props.hasMore || !isNearBottom()) return;
    loading = true;
    Promise.resolve(props.onLoadMore?.()).finally(() => {
      loading = false;
      if (props.hasMore && isNearBottom()) maybeLoadMore();
    });
  };

  onMount(() => {
    if (!props.onLoadMore || !sentinelRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries[0]?.isIntersecting ?? false;
        setIsNearBottom(intersecting);
        if (intersecting) maybeLoadMore();
      },
      { threshold: 0, rootMargin: "0px 0px 300px 0px" },
    );

    observer.observe(sentinelRef);
    onCleanup(() => observer.disconnect());
  });

  // Fires when hasMore becomes true while sentinel is already in view
  // (e.g. first data load with few items that don't fill the page)
  createEffect(() => {
    if (props.hasMore && isNearBottom()) maybeLoadMore();
  });

  return (
    <DataTableRoot>
      <ScrollContainer>
        <Show when={props.issueDrag}>
          <DraggableIssueDataTableBody {...props} />
        </Show>
        <Show when={!props.issueDrag}>
          <DataTableBody {...props} />
        </Show>
        <div ref={(el) => (sentinelRef = el)} class="h-px" />
      </ScrollContainer>
    </DataTableRoot>
  );
}

export function DataTableHeaders<TData>(props: DataTableProps<TData>) {
  return (
    <DataTableGrid gridTemplateColumns={props.gridTemplateColumns()} class="shrink-0">
      <DataTableHead>
        <For each={props.table.getFlatHeaders()}>
          {(header) => (
            <DataTableHeader class={header.column.columnDef.meta?.headerClass}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </DataTableHeader>
          )}
        </For>
      </DataTableHead>
    </DataTableGrid>
  );
}

export function DataTableBody<TData>(props: DataTableProps<TData>) {
  return (
    <DataTableGrid gridTemplateColumns={props.gridTemplateColumns()}>
      <For each={props.table.getRowModel().rows}>{(row) => <DataRow row={row} />}</For>
    </DataTableGrid>
  );
}

export function DraggableIssueDataTableBody<TData>(props: DataTableProps<TData>) {
  return (
    <DataTableGrid gridTemplateColumns={props.gridTemplateColumns()}>
      <For each={props.table.getRowModel().rows}>
        {(row) => <DraggableIssueDataRow row={row} />}
      </For>
    </DataTableGrid>
  );
}

type DataRowProps<TData> = {
  row: Row<TData>;
  ref?: (el: HTMLAnchorElement | HTMLDivElement) => void;
};

function DataRow<TData>(props: DataRowProps<TData>) {
  if (props.row.linkProps) {
    return (
      <DataTableLinkRow
        {...props.row.linkProps}
        data-state={props.row.getIsSelected() ? "selected" : undefined}
        draggable={false}
        class="touch-none"
        ref={(el) => props.ref?.(el)}
      >
        <For each={props.row.getVisibleCells()}>
          {(cell) => (
            <DataTableCell class={cell.column.columnDef.meta?.cellClass}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </DataTableCell>
          )}
        </For>
      </DataTableLinkRow>
    );
  }

  return (
    <DataTableRow
      data-state={props.row.getIsSelected() ? "selected" : undefined}
      ref={(el) => props.ref?.(el)}
    >
      <For each={props.row.getVisibleCells()}>
        {(cell) => (
          <DataTableCell class={cell.column.columnDef.meta?.cellClass}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </DataTableCell>
        )}
      </For>
    </DataTableRow>
  );
}

function DraggableIssueDataRow<TData>(props: DataRowProps<TData>) {
  const { useDraggable } = useIssueDnD();
  const setRef = useDraggable(props.row.original as SerializedIssue);

  return <DataRow {...props} ref={(el) => setRef(el)} />;
}
