import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { UserAvatar } from "@/components/custom-ui/avatar";
import { Badge } from "@/components/custom-ui/badge";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-sections";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { useSessionData } from "@/context/session-context";
import { createAsync, useParams, A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { memberDetailLoader } from "./[userId].data";
import { getLocale } from "@/paraglide/runtime";
import { useWorkspaceData } from "@/context/workspace-context";

export default function MemberDetailPage() {
  const params = useParams();
  const session = useSessionData();
  const member = createAsync(() => memberDetailLoader(params.workspaceSlug!, params.userId!));
  const isCurrentUser = () => member()?.id === session().user.id;
  const workspaceData = useWorkspaceData();

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return m.members_detail_unknown_date();
    return new Intl.DateTimeFormat(getLocale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <>
      <Title>{m.meta_title_member({ name: member()?.name ?? "Member" })}</Title>
      <Meta name="description" content={m.meta_desc_member()} />
      <PageHeader>
        <Breadcrumbs>
          <BreadcrumbsItem
            linkProps={{
              href: `/${params.workspaceSlug}/members`,
            }}
          >
            {m.members_detail_breadcrumb_members()}
          </BreadcrumbsItem>
          <BreadcrumbsItem>
            {member()?.name ?? m.members_detail_breadcrumb_member_fallback()}
          </BreadcrumbsItem>
        </Breadcrumbs>
      </PageHeader>
      <ScrollContainer>
        <Show when={member()}>
          {(memberData) => (
            <div class="flex flex-col gap-6 w-full max-w-3xl mx-auto pt-12">
              <div class="flex items-center gap-4 px-6">
                <UserAvatar user={memberData()} size="lg" />
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2">
                    <h1 class="text-2xl font-medium truncate">{memberData().name}</h1>
                    <Show when={isCurrentUser()}>
                      <Badge>{m.members_detail_badge_you()}</Badge>
                    </Show>
                  </div>
                  <Show when={memberData().email}>
                    <span class="text-sm text-muted-foreground truncate">{memberData().email}</span>
                  </Show>
                </div>
              </div>

              <SettingsSection title={m.members_detail_section_details()}>
                <SettingsCard>
                  <Show when={memberData().email}>
                    <SettingsRow title={m.members_detail_row_email()}>
                      <a href={`mailto:${memberData().email}`} class="text-sm hover:underline">
                        {memberData().email}
                      </a>
                    </SettingsRow>
                  </Show>
                  <SettingsRow title={m.members_detail_row_joined()}>
                    <span class="text-sm">{formatDate(memberData().createdAt)}</span>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection
                title={m.members_detail_section_teams({
                  workspaceName: workspaceData().workspace.displayName,
                })}
              >
                <SettingsCard>
                  <Show
                    when={memberData().teams && memberData().teams.length > 0}
                    fallback={
                      <div class="px-4 py-3.5">
                        <p class="text-sm text-muted-foreground">{m.members_detail_no_teams()}</p>
                      </div>
                    }
                  >
                    <div class="px-4 py-3.5 flex flex-wrap gap-2">
                      <For each={memberData().teams}>
                        {(team) => (
                          <A
                            href={`/${params.workspaceSlug}/team/${team.key}/issues/board`}
                            class="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-accent hover:bg-accent/80 transition-colors"
                          >
                            {team.name}
                          </A>
                        )}
                      </For>
                    </div>
                  </Show>
                </SettingsCard>
              </SettingsSection>
            </div>
          )}
        </Show>
      </ScrollContainer>
    </>
  );
}
