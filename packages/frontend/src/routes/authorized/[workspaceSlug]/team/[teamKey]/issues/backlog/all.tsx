import { createAsync, useParams } from "@solidjs/router";
import CircleDashedIcon from "lucide-solid/icons/circle-dashed";
import PlusIcon from "lucide-solid/icons/plus";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useCreateDialog } from "@/context/create-dialog.context";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { backlogLoader } from "../backlog.data";
import { IssueListPage } from "../_components/issue-list-page";

export default function BacklogAllPage() {
  const params = useParams();
  const issues = createAsync(() => backlogLoader(params.teamKey!, true));

  const baseHref = () => `/${params.workspaceSlug}/team/${params.teamKey}/issues/backlog`;

  return (
    <>
      <Title>{m.meta_title_backlog()}</Title>
      <Meta name="description" content={m.meta_desc_backlog()} />
      <IssueListPage
        issues={issues()}
        breadcrumbLabel={m.team_issues_backlog_breadcrumb()}
        segmentOptions={[
          { label: m.team_issues_backlog_filter_active(), href: `${baseHref()}/active` },
          { label: m.team_issues_backlog_filter_all(), href: `${baseHref()}/all` },
        ]}
        emptyState={<BacklogEmpty />}
      />
    </>
  );
}

function BacklogEmpty() {
  const { open } = useCreateDialog();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleDashedIcon />
        </EmptyMedia>
        <EmptyTitle>{m.team_issues_backlog_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.team_issues_backlog_empty_description()}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div class="w-auto">
          <Button onClick={() => open()}>
            <PlusIcon class="size-4" strokeWidth={2.75} />
            {m.common_create()}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
