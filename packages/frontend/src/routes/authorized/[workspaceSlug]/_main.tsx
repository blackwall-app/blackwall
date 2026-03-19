import { AppSidebar } from "@/components/blocks/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CreateDialogProvider } from "@/context/create-dialog.context";
import { useWorkspaceData } from "@/context/workspace-context";
import { shouldRedirectTeamlessWorkspace } from "@/lib/workspace-routing";
import { Navigate, useLocation } from "@solidjs/router";
import { Show, Suspense, type ParentComponent } from "solid-js";

const MainLayout: ParentComponent = (props) => {
  const workspaceData = useWorkspaceData();
  const location = useLocation();

  const noTeamsAndOffRoot = () => {
    return shouldRedirectTeamlessWorkspace({
      pathname: location.pathname,
      workspaceSlug: workspaceData().workspace.slug,
      teamsCount: workspaceData().teams.length,
    });
  };

  return (
    <SidebarProvider mobileBreakpoint={1024}>
      <CreateDialogProvider>
        <AppSidebar />
        <main class="relative flex min-h-0 h-full w-full flex-1 flex-col bg-background overflow-hidden">
          <Suspense>
            <Show
              when={!noTeamsAndOffRoot()}
              fallback={<Navigate href={`/${workspaceData().workspace.slug}`} />}
            >
              {props.children}
            </Show>
          </Suspense>
        </main>
      </CreateDialogProvider>
    </SidebarProvider>
  );
};

export default MainLayout;
