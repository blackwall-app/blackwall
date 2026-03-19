import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { sprintDetailLoader } from "./index.data";
import { useTeamData } from "../../../[teamKey]";
import { EditSprintForm } from "@/components/sprints/edit-sprint-form";
import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";

export default function EditSprintPage() {
  const params = useParams();
  const teamData = useTeamData();
  const data = createAsync(() => sprintDetailLoader(params.teamKey!, params.sprintId!));
  const sprint = () => data()?.sprint;

  return (
    <>
      <Title>{m.meta_title_edit_sprint()}</Title>
      <Meta name="description" content={m.meta_desc_edit_sprint()} />
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
                linkProps={{ href: `/${params.workspaceSlug}/team/${params.teamKey}/sprints` }}
              >
                {m.team_sprints_list_breadcrumb()}
              </BreadcrumbsItem>
              <BreadcrumbsItem
                linkProps={{
                  href: `/${params.workspaceSlug}/team/${params.teamKey}/sprints/${params.sprintId}`,
                }}
              >
                {sprint()!.name}
              </BreadcrumbsItem>
              <BreadcrumbsItem>{m.common_edit()}</BreadcrumbsItem>
            </Breadcrumbs>
          </PageHeader>

          <ScrollContainer>
            <EditSprintForm
              workspaceSlug={params.workspaceSlug!}
              teamKey={params.teamKey!}
              team={teamData()}
              sprint={sprint()!}
            />
          </ScrollContainer>
        </>
      </Show>
    </>
  );
}
