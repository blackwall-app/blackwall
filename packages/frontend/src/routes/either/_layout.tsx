import { AuthShell } from "@/components/blocks/auth";
import { UserAvatar } from "@/components/custom-ui/avatar";
import { MaybeSessionContext, useMaybeSessionData } from "@/context/maybe-session.context";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { A, createAsync, useNavigate } from "@solidjs/router";
import { Show, type Component, type ParentComponent } from "solid-js";
import { eitherLoader } from "./_layout.data";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SerializedWorkspace } from "@blackwall/database";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import LogOutIcon from "lucide-solid/icons/log-out";

const EitherLayout: ParentComponent = (props) => {
  const loaderData = createAsync(() => eitherLoader());
  const session = () => loaderData()?.sessionData ?? null;

  return (
    <MaybeSessionContext.Provider value={session}>
      <Show when={loaderData()?.preferredWorkspace}>
        <BackButton preferredWorkspace={loaderData()!.preferredWorkspace!} />
      </Show>
      <Show when={session()}>
        <EitherUserMenu />
      </Show>
      <AuthShell>{props.children}</AuthShell>;
    </MaybeSessionContext.Provider>
  );
};

const EitherUserMenu: Component = () => {
  const session = useMaybeSessionData();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/signin");
  };

  return (
    <DropdownMenu gutter={2}>
      <DropdownMenuTrigger
        as="button"
        class={cn(buttonVariants({ variant: "ghost" }), "absolute top-3 right-3 z-100 gap-2")}
        aria-label="Open user menu"
      >
        <UserAvatar user={session()!.user} size="xs" />
        <span class="text-sm font-medium">{session()!.user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="min-w-[12rem]">
        <div class="px-2 py-1.5 text-sm">
          <div class="font-medium">{session()!.user.name}</div>
          <div class="text-muted-foreground text-xs truncate">{session()!.user.email}</div>
        </div>
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOutIcon />
          {m.user_menu_log_out()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const BackButton: Component<{ preferredWorkspace: SerializedWorkspace }> = (props) => {
  return (
    <A
      class={cn(buttonVariants({ variant: "ghost" }), "absolute top-3 left-3 z-100")}
      href={`/${props.preferredWorkspace.slug}`}
    >
      <ArrowLeft class="size-4" />
      {m.either_back_button({ workspace: props.preferredWorkspace.displayName })}
    </A>
  );
};

export default EitherLayout;
