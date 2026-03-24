import { Badge } from "@/components/custom-ui/badge";
import { createDataTable } from "@/components/datatable/create-datatable";
import { BaseIssueDataTable } from "@/components/datatable/datatable";
import type { RowSelectionResult } from "@/components/datatable/row-selection-feature";
import { createSelectionColumn } from "@/components/datatable/selection-column";
import { StatusPickerPopover } from "@/components/issues/pickers/status-picker";
import type { InferDbType } from "@blackwall/database/types";
import { formatDateShort } from "@/lib/dates";
import { issueMappings } from "@/lib/mappings";
import { m } from "@/paraglide/messages.js";
import { createColumnHelper, type ColumnDef } from "@tanstack/solid-table";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import { A } from "@solidjs/router";
import { Index, mergeProps, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

export type IssueForDataTable = Omit<
  InferDbType<"issue", { assignedTo: true; labels: true; issueSprint: true; team: true }>,
  "description"
>;

export type IssueDataTableProps = {
  issues: IssueForDataTable[];
  displaySprints?: boolean;
  workspaceSlug: string;
  rowSelection?: RowSelectionResult;
  issueDrag?: boolean;
  onLoadMore?: () => void | Promise<void>;
  hasMore?: boolean;
};

export function IssueDataTable(props: IssueDataTableProps) {
  const merged = mergeProps({ displaySprints: true }, props);
  const columnHelper = createColumnHelper<IssueForDataTable>();

  const columns = [
    ...(merged.rowSelection ? [createSelectionColumn<IssueForDataTable>()] : []),
    columnHelper.accessor("key", {
      header: m.issue_datatable_header_key(),
      meta: { shrink: true },
      cell: (info) => (
        <span class="px-1 py-0.5 whitespace-nowrap text-xs bg-muted text-muted-foreground rounded-sm border">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: m.issue_datatable_header_status(),
      meta: { shrink: true },
      cell: (info) => {
        const status = issueMappings.status[info.getValue()];
        return (
          <div
            class="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <StatusPickerPopover
              status={info.getValue()}
              issueKey={info.row.original.key}
              trigger={<Dynamic component={status.icon} class={`${status.textClass} size-4`} />}
            />
          </div>
        );
      },
    }),
    columnHelper.accessor("summary", {
      header: m.issue_datatable_header_summary(),
      meta: { expand: true },
      cell: (info) => (
        <div class="flex flex-row items-center gap-2">
          <span class="truncate">{info.getValue()}</span>
          <Index each={info.row.original.labels}>
            {(label) => (
              <Badge size="sm" color={label().colorKey}>
                {label().name}
              </Badge>
            )}
          </Index>
        </div>
      ),
    }),
    ...(merged.displaySprints ? [
      columnHelper.accessor("issueSprint", {
        header: m.issue_datatable_header_sprint(),
        meta: { shrink: true },
        cell: (info) => (
          <Show when={info.getValue()}>
            {(sprint) => (
              <A
                href={`/${merged.workspaceSlug}/team/${info.row.original.team?.key}/sprints/${sprint().id}`}
                class="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded-sm border whitespace-nowrap hover:bg-accent transition-colors"
                title={sprint().name}
                onClick={(e) => e.stopPropagation()}
              >
                <LandPlotIcon class="size-3 shrink-0" />
                <span class="truncate max-w-20">{sprint().name}</span>
              </A>
            )}
          </Show>
        ),
      })] : []),
    columnHelper.accessor("createdAt", {
      header: m.issue_datatable_header_created(),
      meta: { shrink: true },
      cell: (info) => (
        <span class="text-muted-foreground ml-auto hidden sm:block">
          {formatDateShort(new Date(info.getValue()))}
        </span>
      ),
    }) as ColumnDef<IssueForDataTable>,
  ];

  const datatableProps = createDataTable({
    columns,
    data: () => merged.issues,
    getLinkProps: (row) => ({
      href: `/${merged.workspaceSlug}/issue/${row.original.key}`,
    }),
    rowSelection: merged.rowSelection,
    enableRowSelection: !!merged.rowSelection,
    getRowId: (row) => row.id,
  });

  return (
    <BaseIssueDataTable
      {...datatableProps}
      issueDrag={merged.issueDrag}
      onLoadMore={merged.onLoadMore}
      hasMore={merged.hasMore}
    />
  );
}
