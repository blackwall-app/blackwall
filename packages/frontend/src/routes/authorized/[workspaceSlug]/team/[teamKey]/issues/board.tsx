import { PageHeader } from "@/components/blocks/page-header";
import { TeamAvatar, UserAvatar } from "@/components/custom-ui/avatar";
import { Badge } from "@/components/custom-ui/badge";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { ScrollArea, ScrollContainer } from "@/components/custom-ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { IssueStatus } from "@blackwall/database/schema";
import { useCreateDialog } from "@/context/create-dialog.context";
import { BoardDnDContext, createBoardDnD, useBoardDnD } from "@/lib/board-dnd";
import { issueMappings } from "@/lib/mappings";
import { api } from "@/lib/api";
import {
  createAsync,
  useParams,
  A,
  action,
  reload,
  useAction,
  useSubmission,
} from "@solidjs/router";
import CircleIcon from "lucide-solid/icons/circle";
import CircleCheckIcon from "lucide-solid/icons/circle-check";
import CircleDotDashedIcon from "lucide-solid/icons/circle-dot-dashed";
import PlusIcon from "lucide-solid/icons/plus";
import { createMemo, For, Index, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { boardLoader } from "./board.data";
import { useTeamData } from "../../[teamKey]";
import type { InferDbType } from "@blackwall/database/types";
import { sprintsLoader } from "../sprints/index.data";
import { toast } from "@/components/custom-ui/toast";
import { SprintSection } from "./_components/sprint-section";
import { BoardEmpty } from "./_components/board-empty";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { animateDropReturn, createBoardAnimation } from "@/lib/board-animation";
import { ORDER_GAP, buildMoveIssueRequest } from "@/lib/board-order";

type IssueForBoard = Omit<
  InferDbType<
    "issue",
    {
      assignedTo: true;
      labels: true;
    }
  >,
  "description"
>;

const columns = [
  { id: "to_do", icon: CircleIcon },
  { id: "in_progress", icon: CircleDotDashedIcon },
  { id: "done", icon: CircleCheckIcon },
] as const;

const moveIssue = action(
  async (input: {
    issueKey: string;
    status: IssueStatus;
    previousIssueKey: string | null;
    nextIssueKey: string | null;
    optimisticIssueKeys: string[];
  }) => {
    const { optimisticIssueKeys: _optimisticIssueKeys, ...request } = input;
    await api.api.issues.move.$patch({
      json: request,
    });

    throw reload({ revalidate: ["boardIssues", "issueShow"] });
  },
);

const startSprintAction = action(async (teamKey: string, sprintId: string) => {
  await api.api.teams[":teamKey"].sprints[":sprintId"].start.$post({
    param: { teamKey, sprintId },
  });
  toast.success(m.common_sprint_started());
});

export default function BoardPage() {
  const params = useParams();
  const teamData = useTeamData();
  const loaderData = createAsync(() => boardLoader(params.teamKey!));
  const sprints = createAsync(() => sprintsLoader(params.teamKey!));
  const _moveIssue = useAction(moveIssue);
  const _startSprint = useAction(startSprintAction);
  const moveSubmission = useSubmission(moveIssue);

  const dnd = createBoardDnD();
  const { dragState, resetDrag } = dnd;

  const optimisticIssues = createMemo(() => {
    const issues = loaderData() ?? [];
    if (!moveSubmission.pending) return issues;

    const [submissionInput] = moveSubmission.input;
    const { issueKey, optimisticIssueKeys, status: newStatus } = submissionInput;
    return issues.map((issue) => {
      const newIndex = optimisticIssueKeys.indexOf(issue.key);
      if (newIndex !== -1) {
        return {
          ...issue,
          status: issue.key === issueKey ? newStatus : issue.status,
          sortOrder: (newIndex + 1) * ORDER_GAP,
        };
      }
      return issue;
    });
  });

  const data = createMemo(() => {
    const grouped = optimisticIssues().reduce(
      (acc, issue) => {
        if (!acc[issue.status]) {
          acc[issue.status] = [];
        }
        acc[issue.status].push(issue);
        return acc;
      },
      {} as Record<IssueStatus, IssueForBoard[]>,
    );

    for (const status in grouped) {
      grouped[status as IssueStatus].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return grouped;
  });

  const activeSprint = createMemo(
    () =>
      (sprints() ?? []).find((sprint) => sprint.status === "active") ??
      teamData().activeSprint ??
      null,
  );

  const firstPlannedSprint = createMemo(
    () => (sprints() ?? []).find((sprint) => sprint.status === "planned") ?? null,
  );

  let overlayRef: HTMLElement | undefined;
  let boardContainerRef: HTMLElement | undefined;

  async function handleDrop() {
    if (!dragState.draggedIssueKey || !dragState.overColumnId) {
      resetDrag();
      return;
    }

    const issueKey = dragState.draggedIssueKey;
    const newStatus = dragState.overColumnId;
    const targetIndex = dragState.overIndex;

    const moveRequest = buildMoveIssueRequest({
      issueKey,
      status: newStatus,
      targetIndex,
      issuesInTargetColumn: data()[newStatus] ?? [],
    });

    const finalize = async () => {
      resetDrag();
      await _moveIssue(moveRequest);
    };

    if (
      overlayRef &&
      boardContainerRef &&
      animateDropReturn(overlayRef, boardContainerRef, finalize)
    )
      return;
    await finalize();
  }

  return (
    <>
      <Title>{m.meta_title_board()}</Title>
      <Meta name="description" content={m.meta_desc_board()} />
      <BoardDnDContext.Provider value={{ ...dnd, onDrop: handleDrop }}>
        <div class="flex flex-col h-full">
          <div class="flex flex-col">
            <PageHeader>
              <div class="flex flex-1 flex-row items-center justify-between">
                <Breadcrumbs>
                  <BreadcrumbsItem>
                    <div class="flex flex-row items-center gap-1">
                      <TeamAvatar team={teamData()} size="5" />
                      {teamData().name}
                    </div>
                  </BreadcrumbsItem>
                  <BreadcrumbsItem>{m.team_issues_board_breadcrumb()}</BreadcrumbsItem>
                </Breadcrumbs>

                <SprintSection sprint={activeSprint()} />
              </div>
            </PageHeader>
          </div>
          <Show
            when={activeSprint()}
            fallback={
              <div class="p-4">
                <BoardEmpty
                  plannedSprint={firstPlannedSprint()}
                  onStartPlannedSprint={(sprintId) => _startSprint(params.teamKey!, sprintId)}
                />
              </div>
            }
          >
            <ScrollContainer>
              <div ref={(el) => (boardContainerRef = el)} class="p-4 min-h-full">
                <ScrollArea
                  rootClass="min-h-full"
                  viewportRef={(el) => dnd.setScrollContainerRef(el)}
                >
                  <div class="flex flex-row gap-4 relative min-h-full">
                    <For each={columns}>
                      {(col) => (
                        <BoardList
                          statusName={issueMappings.status[col.id].label}
                          statusId={col.id}
                          issues={data()[col.id] ?? []}
                          statusIcon={col.icon}
                        />
                      )}
                    </For>

                    <Show when={dragState.isDragging && dragState.initialRect}>
                      <DragOverlay ref={(el) => (overlayRef = el)} issues={loaderData() ?? []} />
                    </Show>
                  </div>
                </ScrollArea>
              </div>
            </ScrollContainer>
          </Show>
        </div>
      </BoardDnDContext.Provider>
    </>
  );
}

function BoardCard(props: { issue: IssueForBoard }) {
  return (
    <div class="w-full flex flex-col p-4 ring-[0.5px] ring-foreground/10 ring-inset squircle-md relative shadow-sm bg-background select-none hover:bg-surface">
      <div class="pb-2">
        <p class="font-medium text-lg">{props.issue.summary}</p>
      </div>
      <Show when={props.issue.labels.length}>
        <div class="flex flex-wrap gap-2 items-center pb-2">
          <Index each={props.issue.labels}>
            {(label) => (
              <Badge color={label().colorKey} size="sm">
                {label().name}
              </Badge>
            )}
          </Index>
        </div>
      </Show>
      <div class="flex flex-row gap-2 items-center justify-end w-full grow pt-2">
        <p class="font-normal text-muted-foreground">{props.issue.key}</p>
        <Show when={props.issue.assignedTo}>
          <UserAvatar user={props.issue.assignedTo} size="sm" />
        </Show>
      </div>
    </div>
  );
}

function DragOverlay(props: { issues: IssueForBoard[]; ref?: (el: HTMLElement) => void }) {
  const { dragState } = useBoardDnD();
  const draggedIssue = createMemo(() =>
    props.issues.find((i) => i.key === dragState.draggedIssueKey),
  );

  return (
    <Show when={draggedIssue()}>
      {(issue) => (
        <div
          ref={props.ref}
          class="fixed pointer-events-none z-50 transition-transform duration-75"
          style={{
            left: `${dragState.initialRect!.left + dragState.dragX}px`,
            top: `${dragState.initialRect!.top + dragState.dragY}px`,
            width: `${dragState.initialRect!.width}px`,
          }}
        >
          <BoardCard issue={issue()} />
        </div>
      )}
    </Show>
  );
}

type BoardListProps = {
  statusName: string;
  statusId: IssueForBoard["status"];
  statusIcon?: Component<{
    class?: string;
  }>;
  issues: Array<IssueForBoard>;
};

/** Returns the visual index adjusted for the dragged item occupying a slot in the same column. */
function adjustedDropIndex(visualIndex: number, draggedIndex: number): number {
  if (draggedIndex === -1) return visualIndex;
  return visualIndex > draggedIndex ? visualIndex - 1 : visualIndex;
}

function BoardList(props: BoardListProps) {
  const mappedStatus = () => issueMappings.status[props.statusId];
  const params = useParams();
  const teamData = useTeamData();
  const { dragState, setColumnRef } = useBoardDnD();
  const { open } = useCreateDialog();

  const isDropTarget = () => dragState.isDragging && dragState.overColumnId === props.statusId;

  const draggedIndex = createMemo(() =>
    props.issues.findIndex((i) => i.key === dragState.draggedIssueKey),
  );

  const displayIssues = createMemo(() => {
    return [...props.issues].sort((a, b) => a.sortOrder - b.sortOrder);
  });

  const setAnimationRef = createBoardAnimation(dragState, props.statusId);

  return (
    <div class="flex flex-col min-w-80 group" data-testid={`board-column-${props.statusId}`}>
      <div class={`pb-2 text-sm flex flex-row items-center ${mappedStatus().textClass}`}>
        <Dynamic class="size-4 mr-1" component={props.statusIcon} />
        <p>{props.statusName}</p>
        <Badge size="sm" class="ml-2">
          {props.issues.length}
        </Badge>

        <Button
          variant="secondary"
          class="size-5! p-0! items-center! justify-center! ml-auto hidden group-hover:flex"
          aria-label={m.common_create()}
          onClick={() =>
            open({
              status: props.statusId,
              teamKey: params.teamKey,
              sprintId: teamData().activeSprintId,
            })
          }
        >
          <PlusIcon class="size-4 shrink-0" />
        </Button>
      </div>
      <div
        ref={(el) => {
          setAnimationRef(el);
          setColumnRef(props.statusId, el);
        }}
        class="bg-card squircle-lg p-2 ring-1 ring-inset h-full grow flex flex-col gap-2.5 transition-sensible ring-foreground/12"
        data-testid={`board-column-dropzone-${props.statusId}`}
      >
        <Show
          when={displayIssues().length > 0 || isDropTarget()}
          fallback={
            <span class="p-6 text-center text-muted-foreground">{m.common_no_issues()}</span>
          }
        >
          <For each={displayIssues()}>
            {(issue, index) => (
              <>
                <Show
                  when={
                    isDropTarget() &&
                    dragState.overIndex === adjustedDropIndex(index(), draggedIndex()) &&
                    issue.key !== dragState.draggedIssueKey
                  }
                >
                  <DropIndicator />
                </Show>
                <BoardItem issue={issue} />
              </>
            )}
          </For>
          <Show
            when={
              isDropTarget() &&
              dragState.overIndex >= displayIssues().length - (draggedIndex() !== -1 ? 1 : 0)
            }
          >
            <DropIndicator />
          </Show>
        </Show>
        <span role="none" class="h-20" />
      </div>
    </div>
  );
}

function DropIndicator() {
  const { dragState } = useBoardDnD();
  const height = () => dragState.initialRect?.height ?? 0;

  return (
    <div
      data-drop-indicator
      class="border-2 border-dashed border-primary/40 bg-primary/5 squircle-md animate-in fade-in duration-200"
      style={{ height: `${height()}px` }}
    />
  );
}

type BoardItemProps = {
  issue: IssueForBoard;
};

function BoardItem(props: BoardItemProps) {
  const { dragState, useDraggable, onDrop } = useBoardDnD();
  const params = useParams();

  const isDragged = () => dragState.isDragging && dragState.draggedIssueKey === props.issue.key;

  const setRef = useDraggable(props.issue.key, props.issue.status, {
    onDrop,
  });

  return (
    <A
      ref={setRef}
      data-issue-key={props.issue.key}
      data-testid={`board-card-${props.issue.key}`}
      classList={{
        hidden: isDragged(),
      }}
      style={{ "touch-action": "none" }}
      draggable={false}
      href={`/${params.workspaceSlug}/issue/${props.issue.key}`}
    >
      <BoardCard issue={props.issue} />
    </A>
  );
}
