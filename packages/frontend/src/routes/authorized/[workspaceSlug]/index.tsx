import { PageHeader } from "@/components/blocks/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useWorkspaceData } from "@/context/workspace-context";
import { m } from "@/paraglide/messages.js";
import { Navigate } from "@solidjs/router";
import UsersIcon from "lucide-solid/icons/users";
import { Show } from "solid-js";

export default function WorkspaceIndex() {
  const workspaceData = useWorkspaceData();

  return (
    <Show
      when={workspaceData().teams.length > 0}
      fallback={
        <div class="flex flex-col flex-1">
          <PageHeader />
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>{m.workspace_no_teams_title()}</EmptyTitle>
              <EmptyDescription>{m.workspace_no_teams_description()}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      }
    >
      <Navigate href={`/${workspaceData().workspace.slug}/my-issues`} />
    </Show>
  );
}
