import type { ColorKey, IssuePriority, IssueStatus } from "@blackwall/database/schema";
import { Badge } from "@/components/custom-ui/badge";
import { FastLink } from "@/components/custom-ui/fast-link";
import { createRowSelection } from "@/components/datatable/row-selection-feature";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateShort } from "@/lib/dates";
import { issueMappings } from "@/lib/mappings";
import { m } from "@/paraglide/messages.js";
import { Index } from "solid-js";
import { Dynamic } from "solid-js/web";

type IssueForList = {
  id: string;
  key: string;
  summary: string;
  status: IssueStatus;
  priority: IssuePriority;
  createdAt: Date;
  labels: Array<{ id: string; name: string; colorKey: ColorKey }>;
};

export type IssueListProps = {
  issues: IssueForList[];
  workspaceSlug: string;
};

export function IssueList(props: IssueListProps) {
  const currentYear = () => new Date().getFullYear();
  const hasPreviousYearIssues = () =>
    props.issues.some((issue) => {
      return issue.createdAt.getFullYear() !== currentYear();
    });

  const {
    rowSelection,
    setRowSelection,
    getSelectedRowIds: _getSelectedRowIds,
    clearSelection: _clearSelection,
  } = createRowSelection();

  const isRowSelected = (issueId: string) => !!rowSelection()[issueId];
  const toggleRowSelection = (issueId: string) => {
    setRowSelection((prev) => ({
      ...prev,
      [issueId]: !prev[issueId],
    }));
  };

  return (
    <div class="flex flex-col">
      <Index each={props.issues}>
        {(issue) => (
          <IssueListItem
            issue={issue()}
            workspaceSlug={props.workspaceSlug}
            hasPreviousYearIssues={hasPreviousYearIssues()}
            isSelected={isRowSelected(issue().id)}
            onToggleSelection={() => toggleRowSelection(issue().id)}
          />
        )}
      </Index>
    </div>
  );
}

function IssueListItem(props: {
  issue: IssueForList;
  workspaceSlug: string;
  hasPreviousYearIssues?: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const status = () => issueMappings.status[props.issue.status];

  return (
    <FastLink
      class="px-4 py-3 hover:bg-accent bg-background flex flex-row min-w-0 items-center justify-between"
      href={`/${props.workspaceSlug}/issue/${props.issue.key}`}
    >
      <div class="flex flex-row items-center flex-1 min-w-0">
        <Checkbox
          size="sm"
          visibility="outline"
          checked={props.isSelected}
          onChange={props.onToggleSelection}
          aria-label={m.datatable_selection_select_row()}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        />
        <span class="px-1 py-0.5 whitespace-nowrap shrink-0 text-xs bg-muted text-muted-foreground rounded-sm border ml-2">
          {props.issue.key}
        </span>
        <Dynamic component={status().icon} class={`${status().textClass} size-4 shrink-0 ml-2`} />
        <span class="text-foreground font-medium ml-2 min-w-0 truncate">{props.issue.summary}</span>
      </div>

      <div class="flex flex-row items-center gap-2 text-right shrink-0">
        <div class="flex flex-row items-center gap-1">
          <Index each={props.issue.labels}>
            {(label) => (
              <Badge size="sm" color={label().colorKey}>
                {label().name}
              </Badge>
            )}
          </Index>
        </div>

        <span
          class="text-muted-foreground text-sm whitespace-nowrap"
          classList={{
            "w-[4.2rem]": props.hasPreviousYearIssues === true,
            "w-8": props.hasPreviousYearIssues === false,
          }}
        >
          {formatDateShort(props.issue.createdAt)}
        </span>
      </div>
    </FastLink>
  );
}
