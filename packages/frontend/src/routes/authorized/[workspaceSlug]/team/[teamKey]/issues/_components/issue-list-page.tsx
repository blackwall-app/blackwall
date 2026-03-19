import { action, createAsync, useAction, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show, type JSXElement } from "solid-js";
import { PageHeader } from "@/components/blocks/page-header";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { createRowSelection } from "@/components/datatable/row-selection-feature";
import { IssueDataTable, type IssueForDataTable } from "@/components/issues/issue-datatable";
import { IssueSelectionMenu } from "@/components/issues/issue-selection-menu";
import { IssueDraggingProvider } from "@/context/issue-dragging-context";
import { HideWhileDragging } from "@/components/issues/hide-while-dragging";
import { useTeamData } from "../../../[teamKey]";
import { sprintsLoader } from "../../sprints/index.data";
import { api } from "@/lib/api";
import type { BulkUpdateIssues } from "@blackwall/backend/src/features/issues/issue.zod";
import { toast } from "@/components/custom-ui/toast";
import { m } from "@/paraglide/messages.js";

const moveToSprintAction = action(async (input: BulkUpdateIssues) => {
  await api.api.issues.bulk.$patch({ json: input });
  const count = input.issueIds.length;
  toast.success(m.issues_bulk_move_to_sprint({ count: String(count) }));
});

type Props = {
  issues: IssueForDataTable[] | undefined;
  nextCursor?: string | null;
  onLoadMore?: (
    cursor: string,
  ) => Promise<{ issues: IssueForDataTable[]; nextCursor: string | null }>;
  breadcrumbLabel: string;
  segmentOptions: { label: string; href: string }[];
  emptyState: JSXElement;
};

export function IssueListPage(props: Props) {
  const params = useParams();
  const teamData = useTeamData();
  const sprints = createAsync(() => sprintsLoader(params.teamKey!));
  const moveToSprint = useAction(moveToSprintAction);
  const openSprints = createMemo(() =>
    (sprints() ?? []).filter((sprint) => sprint.status !== "completed"),
  );

  const [extraIssues, setExtraIssues] = createSignal<IssueForDataTable[]>([]);
  const [cursor, setCursor] = createSignal<string | null | undefined>(undefined);

  createEffect(() => {
    if (props.issues !== undefined) {
      setExtraIssues([]);
      setCursor(props.nextCursor);
    }
  });

  const allIssues = createMemo(() => [...(props.issues ?? []), ...extraIssues()]);

  const handleLoadMore = async () => {
    const cur = cursor();
    if (!cur || !props.onLoadMore) return;
    const result = await props.onLoadMore(cur);
    setExtraIssues((prev) => [...prev, ...result.issues]);
    setCursor(result.nextCursor);
  };

  const rowSelection = createRowSelection();

  const selectedIssues = createMemo(() => {
    const selectedIds = rowSelection.getSelectedRowIds();
    const issueMap = new Map(allIssues().map((issue) => [issue.id, issue]));
    return selectedIds
      .map((id) => issueMap.get(id))
      .filter((issue): issue is IssueForDataTable => !!issue);
  });

  return (
    <IssueDraggingProvider
      sprints={openSprints()}
      selectedIssues={selectedIssues}
      onDrop={(issues, sprint) =>
        moveToSprint({ issueIds: issues.map((i) => i.id), updates: { sprintId: sprint.id } })
      }
    >
      <PageHeader>
        <Breadcrumbs>
          <BreadcrumbsItem>
            <div class="flex flex-row items-center gap-1">
              <TeamAvatar team={teamData()} size="5" />
              {teamData().name}
            </div>
          </BreadcrumbsItem>
          <BreadcrumbsItem>{props.breadcrumbLabel}</BreadcrumbsItem>
        </Breadcrumbs>
        <SegmentedControl options={props.segmentOptions} />
      </PageHeader>

      <HideWhileDragging>
        <IssueSelectionMenu
          selectedIssues={selectedIssues()}
          onClearSelection={rowSelection.clearSelection}
          openSprints={openSprints()}
        />
      </HideWhileDragging>

      <Show when={allIssues().length > 0} fallback={props.emptyState}>
        <IssueDataTable
          issues={allIssues()}
          workspaceSlug={params.workspaceSlug!}
          rowSelection={rowSelection}
          issueDrag={true}
          onLoadMore={props.onLoadMore ? handleLoadMore : undefined}
          hasMore={!!cursor()}
        />
      </Show>
    </IssueDraggingProvider>
  );
}
