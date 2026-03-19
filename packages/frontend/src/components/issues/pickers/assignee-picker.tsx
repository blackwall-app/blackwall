import { UserAvatar } from "@/components/custom-ui/avatar";
import { PickerPopover } from "@/components/custom-ui/picker-popover";
import { Button } from "@/components/ui/button";
import type { SerializedUser } from "@blackwall/database/schema";
import { cn } from "@/lib/utils";
import { Popover } from "@kobalte/core/popover";
import ChevronsUpDownIcon from "lucide-solid/icons/chevrons-up-down";
import { createMemo, createSignal, Show } from "solid-js";
import { action, reload, useAction } from "@solidjs/router";
import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";

const updateAssignee = action(async (issueKey: string, assignedToId: string | null) => {
  await api.api.issues[":issueKey"].$patch({
    param: { issueKey: issueKey },
    json: { assignedToId: assignedToId },
  });

  throw reload({ revalidate: ["issueShow"] });
});

type AssigneePickerPopoverProps =
  | {
      assignableUsers: SerializedUser[];
      assignedToId: string | null;
      workspaceSlug: string;
      teamKey: string;
      loading?: boolean;
      small?: boolean;
      issueKey: string;
      controlled?: false;
    }
  | {
      assignableUsers: SerializedUser[];
      assignedToId: string | null;
      workspaceSlug: string;
      teamKey: string;
      loading?: boolean;
      small?: boolean;
      issueKey?: never;
      handleChange?: (id: string | null) => void;
      controlled: true;
    };

export function AssigneePickerPopover(props: AssigneePickerPopoverProps) {
  const [open, setOpen] = createSignal(false);
  const assignedTo = () => props.assignableUsers.find((user) => user.id === props.assignedToId);

  const assignableUsersOptions = createMemo(() => {
    const options = props.assignableUsers.map((user) => ({
      id: user.id,
      label: user.name,
      icon: () => <UserAvatar user={user} size="xs" />,
    }));

    return [
      {
        id: null,
        label: m.issue_picker_unassigned(),
        icon: () => <UserAvatar user={null} size="xs" />,
      },
      ...options,
    ];
  });

  const _update = useAction(updateAssignee);

  const handleChange = async (id: string | null) => {
    if (props.controlled) {
      props.handleChange?.(id);
      return;
    }

    _update(props.issueKey, id);
  };

  return (
    <Popover open={open()} onOpenChange={setOpen} placement="bottom-start" gutter={8}>
      <Popover.Trigger
        class={cn({
          "flex flex-row gap-2 items-center text-base px-2!": !props.small,
          "pl-1! pr-2! py-1! h-auto!": props.small,
        })}
        as={Button}
        variant="outline"
        size={props.small ? "sm" : "lg"}
        scaleEffect={false}
      >
        <UserAvatar user={assignedTo()} size={props.small ? "5" : "xs"} />
        {assignedTo()?.name ?? m.issue_picker_no_one()}
        <Show when={!props.small}>
          <ChevronsUpDownIcon class="size-4" />
        </Show>
      </Popover.Trigger>

      <PickerPopover
        value={props.assignedToId}
        onChange={handleChange}
        options={assignableUsersOptions()}
        loading={props.loading}
      />
    </Popover>
  );
}
