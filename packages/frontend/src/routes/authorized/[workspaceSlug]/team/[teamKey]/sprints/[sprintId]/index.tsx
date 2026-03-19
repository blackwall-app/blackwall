import {
  action,
  createAsync,
  redirect,
  useAction,
  useNavigate,
  useParams,
  useSubmission,
  A,
} from "@solidjs/router";
import { Show, createMemo, createSignal, createEffect, onCleanup } from "solid-js";
import { sprintDetailLoader } from "./index.data";
import { useTeamData } from "../../../[teamKey]";
import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import CircleDotIcon from "lucide-solid/icons/circle-dot";
import { createRowSelection } from "@/components/datatable/row-selection-feature";
import { IssueDataTable, type IssueForDataTable } from "@/components/issues/issue-datatable";
import { IssueSelectionMenu } from "@/components/issues/issue-selection-menu";
import { formatDateShort } from "@/lib/dates";
import { api } from "@/lib/api";
import { buttonVariants, Button } from "@/components/ui/button";
import CalendarIcon from "lucide-solid/icons/calendar";
import TargetIcon from "lucide-solid/icons/target";
import PlayIcon from "lucide-solid/icons/play";
import CircleCheckIcon from "lucide-solid/icons/circle-check";
import { toast } from "@/components/custom-ui/toast";
import { SprintStatusBadge } from "@/components/sprints/sprint-status-badge";
import { ArchiveSprintDialog } from "@/components/sprints/archive-sprint-dialog";
import { sprintsLoader } from "../index.data";
import { useKeybinds } from "@/context/keybind.context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";

const archiveSprintAction = action(
  async (workspaceSlug: string, teamKey: string, sprintId: string) => {
    await api.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"].$delete({
      param: { teamKey, sprintId },
    });

    toast.success(m.common_sprint_archived_hidden());
    throw redirect(`/${workspaceSlug}/team/${teamKey}/sprints`);
  },
);

const startSprintAction = action(async (teamKey: string, sprintId: string) => {
  await api.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"].start.$post({
    param: { teamKey, sprintId },
  });

  toast.success(m.common_sprint_started());
});

function calculateEstimationStats(issues: IssueForDataTable[]) {
  let totalPoints = 0;
  let completedPoints = 0;
  let estimatedCount = 0;

  for (const issue of issues) {
    if (issue.estimationPoints != null) {
      estimatedCount++;
      totalPoints += issue.estimationPoints;
      if (issue.status === "done") {
        completedPoints += issue.estimationPoints;
      }
    }
  }

  return {
    totalPoints,
    completedPoints,
    estimatedCount,
    totalCount: issues.length,
    progress: totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0,
  };
}

export default function SprintDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const teamData = useTeamData();
  const data = createAsync(() => sprintDetailLoader(params.teamKey!, params.sprintId!));
  const sprints = createAsync(() => sprintsLoader(params.teamKey!));
  const archiveAction = useAction(archiveSprintAction);
  const startAction = useAction(startSprintAction);
  const startSubmission = useSubmission(
    startSprintAction,
    ([teamKey, sprintId]) => teamKey === params.teamKey! && sprintId === params.sprintId!,
  );
  const { addKeybind, removeKeybind } = useKeybinds();
  const [archiveDialogOpen, setArchiveDialogOpen] = createSignal(false);

  const sprint = () => data()?.sprint;
  const isActiveSprint = () => sprint()?.status === "active";
  const isPlanned = () => sprint()?.status === "planned";
  const isCompleted = () => sprint()?.status === "completed";
  const issues = () => (data()?.issues ?? []) as IssueForDataTable[];
  const openSprints = createMemo(() =>
    (sprints() ?? []).filter((item) => item.status !== "completed"),
  );
  const stats = () => calculateEstimationStats(issues());
  const rowSelection = createRowSelection();

  const selectedIssues = createMemo(() => {
    const selectedIds = rowSelection.getSelectedRowIds();
    const issueMap = new Map(issues().map((issue) => [issue.id, issue]));
    return selectedIds
      .map((id) => issueMap.get(id))
      .filter((issue): issue is IssueForDataTable => !!issue);
  });

  const startCurrentSprint = async () => {
    if (!isPlanned() || startSubmission.pending) {
      return;
    }
    await startAction(params.teamKey!, params.sprintId!);
  };

  const goToCompleteSprint = () => {
    if (!isActiveSprint() || isCompleted()) {
      return;
    }
    navigate(`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${params.sprintId}/complete`);
  };

  createEffect(() => {
    addKeybind("s t", () => {
      void startCurrentSprint();
    });
    addKeybind("c o", () => {
      goToCompleteSprint();
    });
    onCleanup(() => {
      removeKeybind("s t");
      removeKeybind("c o");
    });
  });

  return (
    <>
      <Title>{m.meta_title_sprint()}</Title>
      <Meta name="description" content={m.meta_desc_sprint()} />
      <Show when={sprint()}>
        <>
          <PageHeader>
            <Breadcrumbs>
              <BreadcrumbsItem
                linkProps={{
                  href: `/${params.workspaceSlug}/team/${params.teamKey}/issues/board`,
                }}
              >
                <div class="flex flex-row items-center gap-1">
                  <TeamAvatar team={teamData()} size="5" />
                  {teamData().name}
                </div>
              </BreadcrumbsItem>
              <BreadcrumbsItem
                linkProps={{
                  href: `/${params.workspaceSlug}/team/${params.teamKey}/sprints`,
                }}
              >
                {m.team_sprints_list_breadcrumb()}
              </BreadcrumbsItem>
              <BreadcrumbsItem>{sprint()!.name}</BreadcrumbsItem>
            </Breadcrumbs>
          </PageHeader>

          <div class="flex flex-col flex-1 min-h-0">
            <div class="px-6 py-4 border-b flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <h1 class="text-lg font-semibold">{sprint()!.name}</h1>
                  <SprintStatusBadge sprint={sprint()!} />
                </div>
                <div class="flex items-center gap-2">
                  <Show when={isPlanned()}>
                    <A
                      class={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${params.sprintId}/edit`}
                    >
                      {m.common_edit()}
                    </A>
                  </Show>
                  <Show when={isActiveSprint() && !isCompleted()}>
                    <Tooltip>
                      <TooltipTrigger as="div">
                        <A
                          class={buttonVariants({ variant: "default", size: "sm" })}
                          href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${params.sprintId}/complete`}
                        >
                          <CircleCheckIcon class="size-4" />
                          {m.team_sprints_detail_complete_sprint()}
                        </A>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span class="mr-2">{m.team_sprints_detail_complete_sprint()}</span>
                        <KbdGroup>
                          <Kbd>C</Kbd>
                          {m.common_then()}
                          <Kbd>O</Kbd>
                        </KbdGroup>
                      </TooltipContent>
                    </Tooltip>
                  </Show>
                  <Show when={!isActiveSprint()}>
                    <Button variant="outline" size="sm" onClick={() => setArchiveDialogOpen(true)}>
                      {m.common_archive()}
                    </Button>
                  </Show>
                  <Show when={isPlanned()}>
                    <Tooltip>
                      <TooltipTrigger as="div">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={startSubmission.pending}
                          onClick={() => void startCurrentSprint()}
                        >
                          <PlayIcon class="size-4" />
                          {startSubmission.pending
                            ? m.team_sprints_list_action_starting()
                            : m.team_sprints_detail_start_sprint()}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span class="mr-2">{m.team_sprints_detail_start_sprint()}</span>
                        <KbdGroup>
                          <Kbd>S</Kbd>
                          {m.common_then()}
                          <Kbd>T</Kbd>
                        </KbdGroup>
                      </TooltipContent>
                    </Tooltip>
                  </Show>
                </div>
              </div>

              <div class="flex flex-row items-center gap-6 text-sm text-muted-foreground">
                <div class="flex items-center gap-1.5">
                  <CalendarIcon class="size-4" />
                  <span>
                    {formatDateShort(new Date(sprint()!.startDate))} –{" "}
                    {formatDateShort(new Date(sprint()!.endDate))}
                  </span>
                </div>
                <Show when={sprint()!.goal}>
                  <div class="flex items-center gap-1.5">
                    <TargetIcon class="size-4" />
                    <span>{sprint()!.goal}</span>
                  </div>
                </Show>
              </div>

              <Show when={stats().totalPoints > 0}>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">
                      {m.team_sprints_detail_points_completed({
                        completedPoints: String(stats().completedPoints),
                        totalPoints: String(stats().totalPoints),
                      })}
                    </span>
                    <span class="text-muted-foreground">
                      {m.team_sprints_detail_issues_estimated({
                        estimatedCount: String(stats().estimatedCount),
                        totalCount: String(stats().totalCount),
                      })}
                    </span>
                  </div>
                  <div class="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${stats().progress}%` }}
                    />
                  </div>
                </div>
              </Show>
            </div>

            <Show when={!isCompleted()}>
              <IssueSelectionMenu
                selectedIssues={selectedIssues()}
                onClearSelection={rowSelection.clearSelection}
                openSprints={openSprints()}
              />
            </Show>

            <Show when={issues().length > 0} fallback={<SprintIssuesEmpty />}>
              <IssueDataTable
                issues={issues()}
                workspaceSlug={params.workspaceSlug!}
                rowSelection={rowSelection}
              />
            </Show>
          </div>

          <ArchiveSprintDialog
            open={archiveDialogOpen()}
            onOpenChange={setArchiveDialogOpen}
            onConfirm={() => archiveAction(params.workspaceSlug!, params.teamKey!, sprint()!.id)}
          />
        </>
      </Show>
    </>
  );
}

function SprintIssuesEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleDotIcon />
        </EmptyMedia>
        <EmptyTitle>{m.team_sprints_detail_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.team_sprints_detail_empty_description()}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
