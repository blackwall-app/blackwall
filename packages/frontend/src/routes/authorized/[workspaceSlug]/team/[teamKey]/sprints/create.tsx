import { useParams } from "@solidjs/router";
import { useTeamData } from "../../[teamKey]";
import { SprintForm } from "@/components/sprints/sprint-form";
import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";

export default function CreateSprintPage() {
  const params = useParams();
  const teamData = useTeamData();

  return (
    <>
      <Title>{m.meta_title_create_sprint()}</Title>
      <Meta name="description" content={m.meta_desc_create_sprint()} />
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
          <BreadcrumbsItem>{m.team_sprints_create_breadcrumb()}</BreadcrumbsItem>
        </Breadcrumbs>
      </PageHeader>

      <ScrollContainer>
        <SprintForm
          workspaceSlug={params.workspaceSlug!}
          teamKey={params.teamKey!}
          team={teamData()}
          title={m.team_sprints_create_title({ teamName: teamData().name })}
          buttonText={m.team_sprints_create_submit()}
        />
      </ScrollContainer>
    </>
  );
}
