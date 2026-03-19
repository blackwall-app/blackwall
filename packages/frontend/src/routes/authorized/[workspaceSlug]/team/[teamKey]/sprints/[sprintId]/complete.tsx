import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { sprintCompleteContextLoader } from "./complete.data";
import { useTeamData } from "../../../[teamKey]";
import { CompleteSprintForm } from "@/components/sprints/complete-sprint-form";
import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";

export default function CompleteSprintPage() {
  const params = useParams();
  const teamData = useTeamData();
  const data = createAsync(() => sprintCompleteContextLoader(params.teamKey!, params.sprintId!));

  return (
    <>
      <Title>{m.meta_title_complete_sprint()}</Title>
      <Meta name="description" content={m.meta_desc_complete_sprint()} />
      <Show when={data()} fallback={null}>
        {(sprintData) => (
          <>
            <PageHeader>
              <Breadcrumbs>
                <BreadcrumbsItem
                  linkProps={{
                    href: `/${params.workspaceSlug}/team/${params.teamKey}/issues`,
                  }}
                >
                  <div class="flex flex-row items-center gap-1">
                    <TeamAvatar team={teamData()} size="5" />
                    {teamData().name}
                  </div>
                </BreadcrumbsItem>
                <BreadcrumbsItem>{m.team_sprints_detail_complete_sprint()}</BreadcrumbsItem>
              </Breadcrumbs>
            </PageHeader>

            <ScrollContainer>
              <CompleteSprintForm
                workspaceSlug={params.workspaceSlug!}
                teamKey={params.teamKey!}
                team={teamData()}
                sprint={sprintData().sprint}
                plannedSprints={sprintData().plannedSprints}
                hasUndoneIssues={sprintData().hasUndoneIssues}
              />
            </ScrollContainer>
          </>
        )}
      </Show>
    </>
  );
}
