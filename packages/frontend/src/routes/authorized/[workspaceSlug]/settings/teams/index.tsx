import { TeamAvatar } from "@/components/custom-ui/avatar";
import { createDataTable } from "@/components/datatable/create-datatable";
import { DataTable } from "@/components/datatable/datatable";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-sections";
import { buttonVariants } from "@/components/ui/button";
import { formatDateShort } from "@/lib/dates";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { createColumnHelper } from "@tanstack/solid-table";
import { A, createAsync, useParams } from "@solidjs/router";
import { teamsSettingsLoader } from "./index.data";
import type { SerializedTeam } from "@blackwall/database/schema";

type TeamWithCounts = {
  team: SerializedTeam;
  usersCount: number;
  issuesCount: number;
};

export default function TeamsSettingsPage() {
  const params = useParams();

  return (
    <>
      <Title>{m.meta_title_teams()}</Title>
      <Meta name="description" content={m.meta_desc_teams()} />
      <SettingsPage title={m.settings_teams_index_page_title()} fullWidth>
        <SettingsSection
          title={m.settings_teams_index_section_title()}
          rightContent={
            <A
              class={buttonVariants({ variant: "default", size: "sm" })}
              href={`/${params.workspaceSlug}/settings/teams/create`}
            >
              {m.settings_teams_create_button()}
            </A>
          }
        >
          <TeamTable />
        </SettingsSection>
      </SettingsPage>
    </>
  );
}

function TeamTable() {
  const params = useParams();
  const teamsData = createAsync(() => teamsSettingsLoader());
  const teams = () => (teamsData() ?? []) as TeamWithCounts[];

  const columnHelper = createColumnHelper<TeamWithCounts>();

  const columns = [
    columnHelper.accessor((row) => row.team.name, {
      id: "name",
      header: m.team_sprints_list_table_header_name(),
      meta: {
        expand: true,
      },
      cell: (info) => (
        <div class="flex items-center gap-2 font-medium">
          <TeamAvatar team={info.row.original.team} size="5" />
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.team.key, {
      id: "key",
      header: m.settings_teams_key_title(),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("usersCount", {
      header: m.settings_teams_table_header_members(),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("issuesCount", {
      header: m.settings_teams_table_header_issues(),
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.team.createdAt, {
      id: "createdAt",
      header: m.settings_teams_table_header_created(),
      cell: (info) => formatDateShort(new Date(info.getValue())),
    }),
  ];

  const datatableProps = createDataTable({
    columns,
    data: teams,
    getLinkProps(row) {
      return {
        href: `/${params.workspaceSlug}/settings/teams/${row.original.team.key}`,
      };
    },
  });

  return <DataTable {...datatableProps} />;
}
