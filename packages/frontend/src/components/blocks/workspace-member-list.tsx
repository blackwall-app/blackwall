import { FastLink } from "@/components/custom-ui/fast-link";
import { Index, Show } from "solid-js";
import type { SerializedUser, SerializedWorkspace } from "@blackwall/database/schema";
import { UserAvatar } from "../custom-ui/avatar";
import { useSessionData } from "@/context/session-context";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { InviteDialogContent } from "./invite-dialog";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";
import { m } from "@/paraglide/messages";
import { Badge } from "../custom-ui/badge";

type UserForWorkspaceMemberList = SerializedUser & {
  teams?: { name: string }[];
};

export type WorkspaceMemberListProps = {
  members: UserForWorkspaceMemberList[];
  workspace: SerializedWorkspace;
};

export function WorkspaceMemberList(props: WorkspaceMemberListProps) {
  const memberCount = () => props.members.length;

  return (
    <div class="flex flex-col" data-testid="workspace-members-list">
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <p class="text-sm text-muted-foreground">
          {m.common_member_count({ count: String(memberCount()) })}
        </p>
        <Dialog>
          <DialogTrigger
            as={Button}
            variant="outline"
            size="sm"
            data-testid="workspace-members-invite-trigger"
          >
            {m.common_invite()}
          </DialogTrigger>
          <InviteDialogContent />
        </Dialog>
      </div>
      <div class="flex flex-col divide-y divide-border">
        <Index each={props.members}>
          {(member) => <WorkspaceMemberListItem member={member()} workspace={props.workspace} />}
        </Index>
      </div>
    </div>
  );
}

function WorkspaceMemberListItem(props: {
  member: UserForWorkspaceMemberList;
  workspace: SerializedWorkspace;
}) {
  const session = useSessionData();
  const isCurrentUser = () => props.member.id === session().user.id;
  const teamNames = () => props.member.teams?.map((t) => t.name).join(", ") || "No teams";

  return (
    <FastLink
      class="group px-4 py-3 hover:bg-accent bg-background flex flex-row min-w-0 items-center justify-between"
      href={`/${props.workspace.slug}/members/${props.member.id}`}
      data-testid={`workspace-member-${props.member.id}`}
    >
      <div class="flex flex-row items-center flex-1 min-w-0 gap-3">
        <UserAvatar user={props.member} size="sm" />
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium truncate">{props.member.name}</span>
            <Show when={isCurrentUser()}>
              <Badge size="xs">{m.common_you_badge()}</Badge>
            </Show>
          </div>
          <Show when={props.member.email}>
            <span class="text-xs text-muted-foreground truncate">{props.member.email}</span>
          </Show>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground hidden sm:block">{teamNames()}</span>
        <ChevronRightIcon class="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </FastLink>
  );
}
