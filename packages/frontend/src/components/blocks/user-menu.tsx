import { useSessionData } from "@/context/session-context";
import { useWorkspaceData } from "@/context/workspace-context";
import SelectorIcon from "lucide-solid/icons/chevrons-up-down";
import LogOutIcon from "lucide-solid/icons/log-out";
import SettingsIcon from "lucide-solid/icons/settings";
import { UserAvatar } from "../custom-ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { A, action, redirect, useAction } from "@solidjs/router";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

const logoutAction = action(async () => {
  await authClient.signOut();
  throw redirect("/signin");
});

export function UserMenu() {
  const session = useSessionData();
  const workspaceData = useWorkspaceData();
  const _action = useAction(logoutAction);

  async function onLogOut() {
    await _action();
  }

  return (
    <DropdownMenu gutter={2}>
      <DropdownMenuTrigger
        as={Button}
        class="flex items-center! font-normal justify-start text-left !p-2 h-auto"
        variant="ghost"
        aria-label="Open user menu"
        data-testid="user-menu-trigger"
      >
        <div class="flex flex-row gap-2 items-center w-full min-w-0">
          <UserAvatar user={session().user} class="shrink-0" />
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-base truncate">{session().user.name}</span>
            <span class="text-xs text-muted-foreground truncate">{session().user.email}</span>
          </div>
          <SelectorIcon class="size-4 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="min-w-[12rem]">
        <DropdownMenuItem as={A} href={`/${workspaceData().workspace.slug}/settings/general`}>
          <SettingsIcon />
          {m.user_menu_settings()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogOut}>
          <LogOutIcon />
          {m.user_menu_log_out()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
