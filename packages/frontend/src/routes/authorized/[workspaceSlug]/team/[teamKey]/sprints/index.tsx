import {
  action,
  createAsync,
  redirect,
  useAction,
  useParams,
  useSubmission,
  A,
} from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { sprintsLoader } from "./index.data";
import { useTeamData } from "../../[teamKey]";
import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import type { SerializedIssueSprint } from "@blackwall/database/schema";
import { createColumnHelper, type ColumnDef } from "@tanstack/solid-table";
import { formatDateShort } from "@/lib/dates";
import { createDataTable } from "@/components/datatable/create-datatable";
import { DataTable } from "@/components/datatable/datatable";
import { api } from "@/lib/api";
import { toast } from "@/components/custom-ui/toast";
import { SprintStatusBadge } from "@/components/sprints/sprint-status-badge";
import { ArchiveSprintDialog } from "@/components/sprints/archive-sprint-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MoreHorizontalIcon from "lucide-solid/icons/more-horizontal";
import PlayIcon from "lucide-solid/icons/play";
import CircleCheckIcon from "lucide-solid/icons/circle-check";
import { Button } from "@/components/ui/button";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";

const archiveSprintAction = action(
  async (workspaceSlug: string, teamKey: string, sprintId: string) => {
    await api.api.teams[":teamKey"].sprints[":sprintId"].$delete({
      param: { teamKey, sprintId },
    });

    toast.success(m.common_sprint_archived_hidden());
    throw redirect(`/${workspaceSlug}/team/${teamKey}/sprints`);
  },
);

const startSprintAction = action(async (teamKey: string, sprintId: string) => {
  await api.api.teams[":teamKey"].sprints[":sprintId"].start.$post({
    param: { teamKey, sprintId },
  });

  toast.success(m.common_sprint_started());
});

export default function SprintsPage() {
  const params = useParams();
  const teamData = useTeamData();
  const sprints = createAsync(() => sprintsLoader(params.teamKey!));

  return (
    <>
      <Title>{m.meta_title_sprints()}</Title>
      <Meta name="description" content={m.meta_desc_sprints()} />
      <PageHeader>
        <Breadcrumbs>
          <BreadcrumbsItem>
            <div class="flex flex-row items-center gap-1">
              <TeamAvatar team={teamData()} size="5" />
              {teamData().name}
            </div>
          </BreadcrumbsItem>
          <BreadcrumbsItem>{m.team_sprints_list_breadcrumb()}</BreadcrumbsItem>
        </Breadcrumbs>
        <A
          href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/create`}
          class={cn(buttonVariants({ size: "xs" }), "ml-auto")}
        >
          {m.team_sprints_create_breadcrumb()}
        </A>
      </PageHeader>

      <Show
        when={sprints() && sprints()!.length > 0}
        fallback={<SprintEmpty workspaceSlug={params.workspaceSlug!} teamKey={params.teamKey!} />}
      >
        <SprintTable
          sprints={sprints()!}
          workspaceSlug={params.workspaceSlug!}
          teamKey={params.teamKey!}
        />
      </Show>
    </>
  );
}

function SprintEmpty(props: { workspaceSlug: string; teamKey: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LandPlotIcon />
        </EmptyMedia>
        <EmptyTitle>{m.team_sprints_list_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.team_sprints_list_empty_description()}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <A
          href={`/${props.workspaceSlug}/team/${props.teamKey}/sprints/create`}
          class={buttonVariants()}
        >
          {m.team_sprints_create_breadcrumb()}
        </A>
      </EmptyContent>
    </Empty>
  );
}

type SprintTableProps = {
  sprints: SerializedIssueSprint[];
  workspaceSlug: string;
  teamKey: string;
};

function SprintTable(props: SprintTableProps) {
  const columnHelper = createColumnHelper<SerializedIssueSprint>();
  const archiveAction = useAction(archiveSprintAction);
  const startAction = useAction(startSprintAction);
  const [archiveDialogOpen, setArchiveDialogOpen] = createSignal(false);
  const [selectedSprint, setSelectedSprint] = createSignal<SerializedIssueSprint | null>(null);

  const columns = [
    columnHelper.accessor("name", {
      header: m.team_sprints_list_table_header_name(),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("goal", {
      header: m.team_sprints_list_table_header_goal(),
      meta: { expand: true },
      cell: (info) => info.getValue(),
    }),
    columnHelper.display({
      id: "status",
      header: m.team_sprints_list_table_header_status(),
      cell: (info) => <SprintStatusBadge sprint={info.row.original} />,
    }),
    columnHelper.accessor("startDate", {
      header: m.team_sprints_list_table_header_start_date(),
      cell: (info) => formatDateShort(new Date(info.getValue())),
    }) as ColumnDef<SerializedIssueSprint, string>,
    columnHelper.accessor("endDate", {
      header: m.team_sprints_list_table_header_end_date(),
      cell: (info) => formatDateShort(new Date(info.getValue())),
    }) as ColumnDef<SerializedIssueSprint, string>,
    columnHelper.display({
      id: "actions",
      header: m.team_sprints_list_table_header_actions(),
      cell: (info) => {
        const sprint = info.row.original;
        const isActive = sprint.status === "active";
        const isPlanned = sprint.status === "planned";
        const startSubmission = useSubmission(
          startSprintAction,
          ([teamKey, sprintId]) => teamKey === props.teamKey && sprintId === sprint.id,
        );

        return (
          <div
            class="flex items-center gap-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Show when={isPlanned}>
              <Button
                variant="secondary"
                size="xs"
                disabled={startSubmission.pending}
                onClick={async (e) => {
                  e.stopPropagation();
                  await startAction(props.teamKey, sprint.id);
                }}
              >
                <PlayIcon class="size-3.5" />
                {startSubmission.pending ? m.team_sprints_list_action_starting() : m.common_start()}
              </Button>
            </Show>

            <Show when={isActive}>
              <Button
                as={A}
                href={`/${props.workspaceSlug}/team/${props.teamKey}/sprints/${sprint.id}/complete`}
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <CircleCheckIcon class="size-3.5" />
                {m.common_complete()}
              </Button>
            </Show>

            <DropdownMenu>
              <DropdownMenuTrigger
                as={Button}
                variant="ghost"
                size="iconXs"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontalIcon class="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  as={A}
                  href={`/${props.workspaceSlug}/team/${props.teamKey}/sprints/${sprint.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {m.common_view()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  as={A}
                  href={`/${props.workspaceSlug}/team/${props.teamKey}/sprints/${sprint.id}/edit`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  disabled={!isPlanned}
                >
                  {m.common_edit()}
                </DropdownMenuItem>
                <Show when={!isActive}>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setSelectedSprint(sprint);
                      setArchiveDialogOpen(true);
                    }}
                  >
                    {m.common_archive()}
                  </DropdownMenuItem>
                </Show>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }),
  ];

  const datatableProps = createDataTable({
    columns,
    data: () => props.sprints,
    getLinkProps(row) {
      return {
        href: `/${props.workspaceSlug}/team/${props.teamKey}/sprints/${row.original.id}`,
      };
    },
  });

  return (
    <>
      <DataTable {...datatableProps} />
      <ArchiveSprintDialog
        open={archiveDialogOpen()}
        onOpenChange={setArchiveDialogOpen}
        onConfirm={() =>
          selectedSprint()
            ? archiveAction(props.workspaceSlug, props.teamKey, selectedSprint()!.id)
            : Promise.resolve()
        }
      />
    </>
  );
}
