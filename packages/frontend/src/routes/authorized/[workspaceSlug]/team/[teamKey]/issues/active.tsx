import { createAsync, useParams } from "@solidjs/router";
import AlertCircleIcon from "lucide-solid/icons/alert-circle";
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
import { issuesLoader } from "./issues.data";
import { IssueListPage } from "./_components/issue-list-page";
import { api } from "@/lib/api";

export default function ActiveIssuesPage() {
  const params = useParams();
  const data = createAsync(() => issuesLoader(params.teamKey!, false));

  const baseHref = () => `/${params.workspaceSlug}/team/${params.teamKey}/issues`;

  const loadMore = async (cursor: string) => {
    const res = await api.api.issues.$get({
      query: { teamKey: params.teamKey!, statusFilters: ["to_do", "in_progress"], cursor },
    });
    return res.json();
  };

  return (
    <>
      <Title>{m.meta_title_active_issues()}</Title>
      <Meta name="description" content={m.meta_desc_active_issues()} />
      <IssueListPage
        issues={data()?.issues}
        nextCursor={data()?.nextCursor}
        onLoadMore={loadMore}
        breadcrumbLabel={m.team_issues_breadcrumb()}
        segmentOptions={[
          { label: m.team_issues_backlog_filter_active(), href: `${baseHref()}/active` },
          { label: m.team_issues_backlog_filter_all(), href: `${baseHref()}/all` },
        ]}
        emptyState={<ActiveIssueEmpty />}
      />
    </>
  );
}

function ActiveIssueEmpty() {
  const { open } = useCreateDialog();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon />
        </EmptyMedia>
        <EmptyTitle>{m.team_issues_active_empty_title()}</EmptyTitle>
        <EmptyDescription>{m.team_issues_active_empty_description()}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div class="w-auto">
          <Button onClick={() => open({ status: "to_do" })}>
            <PlusIcon class="size-4" strokeWidth={2.75} />
            {m.common_create()}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
