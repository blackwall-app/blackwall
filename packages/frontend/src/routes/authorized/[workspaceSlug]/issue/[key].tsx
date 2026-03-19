import { PageHeader } from "@/components/blocks/page-header";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { IssueActivityLog } from "@/components/issues/issue-activity-log";
import { IssueDescription } from "@/components/issues/issue-description";
import { IssueMenu } from "@/components/issues/issue-menu";
import { IssueSidebar } from "@/components/issues/issue-sidebar";
import { IssueSummary } from "@/components/issues/issue-summary";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspaceData } from "@/context/workspace-context";
import type { SerializedTeam } from "@blackwall/database/schema";
import { createAsync, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import PanelRightIcon from "lucide-solid/icons/panel-right";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { issueLoader } from "./[key].data";

function IssueMainView(props: {
  issue: Awaited<ReturnType<typeof issueLoader>>["issue"];
  assignableUsers: Awaited<ReturnType<typeof issueLoader>>["assignableUsers"];
  workspaceSlug: string;
}) {
  return (
    <ScrollContainer>
      <main class="min-w-0 px-6 lg:px-12 pb-8 pt-16 flex flex-col max-w-[980px] mx-auto">
        <IssueSummary issue={props.issue} />
        <IssueDescription issue={props.issue} />

        <Separator class="my-8" />

        <IssueActivityLog
          issue={props.issue}
          workspaceSlug={props.workspaceSlug}
          assignableUsers={props.assignableUsers}
        />
      </main>
    </ScrollContainer>
  );
}

export default function IssueDetailPage() {
  const params = useParams();
  const workspaceData = useWorkspaceData();
  const issueData = createAsync(() => issueLoader(params.key!, params.workspaceSlug!));

  return (
    <>
      <Title>{m.meta_title_issue({ key: params.key! })}</Title>
      <Meta name="description" content={m.meta_desc_issue({ key: params.key! })} />
      <PageHeader>
        <Breadcrumbs>
          <BreadcrumbsItem
            linkProps={{
              href: `/${workspaceData().workspace.slug}/team/${issueData()?.issue.team?.key}/issues`,
            }}
          >
            <div class="flex flex-row items-center gap-1">
              <Show when={issueData()?.issue.team}>
                {(team) => <TeamAvatar team={team() as unknown as SerializedTeam} size="5" />}
              </Show>
              <span>{issueData()?.issue.team?.name}</span>
            </div>
          </BreadcrumbsItem>
          <BreadcrumbsItem>{issueData()?.issue.key}</BreadcrumbsItem>
        </Breadcrumbs>

        <Show when={issueData()?.issue}>
          {(issue) => (
            <IssueMenu
              issue={issue()}
              workspaceSlug={params.workspaceSlug!}
              teamKey={issue().team?.key ?? ""}
            />
          )}
        </Show>

        <div id="issue-sidebar-trigger" class="ml-auto" />
      </PageHeader>

      <div class="flex flex-row min-h-0 flex-1 overflow-hidden">
        <SidebarProvider keybind="i" mobileBreakpoint={640}>
          <Show when={issueData()}>
            {(data) => (
              <IssueMainView
                issue={data().issue}
                assignableUsers={data().assignableUsers}
                workspaceSlug={workspaceData().workspace.slug}
              />
            )}
          </Show>

          <Portal mount={document.getElementById("issue-sidebar-trigger")!}>
            <SidebarTrigger class="ml-auto">
              <PanelRightIcon class="size-4" />
            </SidebarTrigger>
          </Portal>

          <Show when={issueData()}>
            {(data) => (
              <IssueSidebar
                issue={data().issue}
                workspaceSlug={workspaceData().workspace.slug}
                teamKey={data().issue.team?.key ?? ""}
                labels={data().labels}
                assignableUsers={data().assignableUsers}
                openSprints={data().openSprints}
              />
            )}
          </Show>
        </SidebarProvider>
      </div>
    </>
  );
}
