import { buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { TextField } from "@/components/ui/text-field";
import { useWorkspaceData } from "@/context/workspace-context";
import { m } from "@/paraglide/messages.js";
import { A } from "@solidjs/router";
import ArrowLeftIcon from "lucide-solid/icons/arrow-left";
import SearchIcon from "lucide-solid/icons/search";
import { createMemo, createSignal, For, type ComponentProps, Show } from "solid-js";
import { FastLink } from "../custom-ui/fast-link";

export function SettingsSidebar(props: ComponentProps<typeof Sidebar>) {
  const workspaceData = useWorkspaceData();
  const [search, setSearch] = createSignal("");

  const items = createMemo(() => [
    {
      href: `/${workspaceData().workspace.slug}/settings/general`,
      label: m.settings_sidebar_menu_general(),
    },
    {
      href: `/${workspaceData().workspace.slug}/settings/profile`,
      label: m.settings_sidebar_menu_profile(),
    },
    {
      href: `/${workspaceData().workspace.slug}/settings/workspace`,
      label: m.settings_sidebar_menu_workspace(),
    },
    {
      href: `/${workspaceData().workspace.slug}/settings/teams`,
      label: m.settings_sidebar_menu_team_management(),
    },
  ]);

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredItems = createMemo(() => {
    const query = normalize(search().trim());

    if (!query) {
      return items();
    }

    return items().filter((item) => normalize(item.label).includes(query));
  });

  return (
    <Sidebar {...props}>
      <SidebarHeader class="flex flex-col gap-2">
        <A
          href="/"
          class={buttonVariants({
            variant: "ghost",
            size: "xs",
            class: "w-fit",
          })}
        >
          <ArrowLeftIcon class="size-4" />
          {m.settings_sidebar_back_to_workspace({
            workspaceName: workspaceData().workspace.displayName,
          })}
        </A>

        <TextField class="relative" value={search()} onChange={setSearch}>
          <div class="absolute h-full pl-2 top-0 bottom-0 left-0 flex items-center justify-center">
            <SearchIcon class="size-4 text-muted-foreground" />
          </div>
          <TextField.Input placeholder={m.settings_sidebar_search_placeholder()} class="pl-7" />
        </TextField>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Show
                when={filteredItems().length > 0}
                fallback={
                  <div class="px-2 py-3 text-sm text-muted-foreground">{m.common_no_results()}</div>
                }
              >
                <For each={filteredItems()}>
                  {(item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton as={FastLink} href={item.href}>
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </For>
              </Show>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
