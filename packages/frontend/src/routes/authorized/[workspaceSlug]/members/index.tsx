import { PageHeader } from "@/components/blocks/page-header";
import { Breadcrumbs, BreadcrumbsItem } from "@/components/custom-ui/breadcrumbs";
import { WorkspaceMemberList } from "@/components/blocks/workspace-member-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import UsersIcon from "lucide-solid/icons/users";
import { useWorkspaceData } from "@/context/workspace-context";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { membersLoader } from "./index.data";

export default function MembersPage() {
  const params = useParams();
  const workspaceData = useWorkspaceData();
  const members = createAsync(() => membersLoader(params.workspaceSlug!));

  return (
    <>
      <Title>{m.meta_title_members()}</Title>
      <Meta name="description" content={m.meta_desc_members()} />
      <PageHeader>
        <Breadcrumbs>
          <BreadcrumbsItem>{m.members_index_breadcrumb()}</BreadcrumbsItem>
        </Breadcrumbs>
      </PageHeader>

      <Show when={members() && members()!.length > 0} fallback={<MembersEmpty />}>
        <WorkspaceMemberList members={members()!} workspace={workspaceData().workspace} />
      </Show>
    </>
  );
}

function MembersEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>{m.members_index_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.members_index_empty_description()}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
