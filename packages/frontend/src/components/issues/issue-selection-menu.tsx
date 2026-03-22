import type { IssueForDataTable } from "./issue-datatable";
import type { IssuePriority, IssueStatus, SerializedIssueSprint } from "@blackwall/database/schema";
import type { User } from "better-auth";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import XIcon from "lucide-solid/icons/x";
import ChevronDownIcon from "lucide-solid/icons/chevron-down";
import TrashIcon from "lucide-solid/icons/trash-2";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import CircleDotIcon from "lucide-solid/icons/circle-dot";
import UserIcon from "lucide-solid/icons/user";
import { Show, createSignal } from "solid-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Popover } from "@kobalte/core/popover";
import { PickerPopover } from "../custom-ui/picker-popover";
import { issueMappings, mappingToOptionArray } from "@/lib/mappings";
import { UserAvatar } from "@/components/custom-ui/avatar";
import { action, useAction } from "@solidjs/router";
import type {
  BulkDeleteIssues,
  BulkUpdateIssues,
} from "@blackwall/backend/src/features/issues/issue.zod";
import { api } from "@/lib/api";
import { toast } from "../custom-ui/toast";
import { SprintPickerPopover } from "./pickers/sprint-picker";
import { m } from "@/paraglide/messages.js";

type IssueSelectionMenuProps = {
  selectedIssues: IssueForDataTable[];
  onClearSelection: () => void;
  openSprints?: SerializedIssueSprint[];
  assignableUsers?: User[];
};

const updateIssuesBulkAction = action(async (input: BulkUpdateIssues) => {
  const res = await api.api.issues.bulk.$patch({
    json: input,
  });

  const json = await res.json();

  toast.success(m.issue_selection_toast_updated());
  return json.issues;
});

const deleteIssuesBulkAction = action(async (input: BulkDeleteIssues) => {
  const res = await api.api.issues.bulk.$delete({
    json: input,
  });

  await res.json();

  toast.success(m.issue_selection_toast_deleted());
});

export function IssueSelectionMenu(props: IssueSelectionMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const _updateAction = useAction(updateIssuesBulkAction);
  const _deleteAction = useAction(deleteIssuesBulkAction);

  const handleUpdate = async (updates: BulkUpdateIssues["updates"]) => {
    await _updateAction({
      issueKeys: props.selectedIssues.map((issue) => issue.key),
      updates,
    });
    props.onClearSelection();
  };

  const handleDelete = async () => {
    await _deleteAction({
      issueKeys: props.selectedIssues.map((issue) => issue.key),
    });
    setDeleteDialogOpen(false);
    props.onClearSelection();
  };

  const assignableUsersOptions = () => {
    if (!props.assignableUsers?.length) return [];

    const options = props.assignableUsers.map((user) => ({
      id: user.id,
      label: user.name,
      icon: () => <UserAvatar user={user} size="xs" />,
    }));

    return [
      {
        id: null,
        label: m.issue_selection_unassigned(),
        icon: () => <UserAvatar user={null} size="xs" />,
      },
      ...options,
    ];
  };

  return (
    <Show when={props.selectedIssues.length > 0}>
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 bg-background border rounded-lg shadow-lg">
        <Button variant="ghost" size="iconXs" onClick={props.onClearSelection}>
          <XIcon class="size-4" />
        </Button>

        <span class="text-sm text-muted-foreground whitespace-nowrap">
          {m.issue_selection_selected_count({ count: String(props.selectedIssues.length) })}
        </span>

        <div class="h-4 w-px bg-border" />

        <Popover placement="top" gutter={8}>
          <Popover.Trigger as={Button} variant="outline" size="xs">
            <CircleDotIcon class="size-4" />
            {m.common_status()}
          </Popover.Trigger>
          <PickerPopover
            value={null}
            onChange={(value) => handleUpdate({ status: value as unknown as IssueStatus })}
            options={mappingToOptionArray(issueMappings.status)}
          />
        </Popover>

        <Popover placement="top" gutter={8}>
          <Popover.Trigger as={Button} variant="outline" size="xs">
            <CircleDotIcon class="size-4" />
            {m.common_priority()}
          </Popover.Trigger>
          <PickerPopover
            value={null}
            onChange={(value) => handleUpdate({ priority: value as unknown as IssuePriority })}
            options={mappingToOptionArray(issueMappings.priority)}
          />
        </Popover>

        <SprintPickerPopover
          sprintId={null}
          openSprints={props.openSprints ?? []}
          onChange={(id) => handleUpdate({ sprintId: id })}
          trigger={
            <>
              <Popover.Trigger as={Button} variant="outline" size="xs" scaleEffect={false}>
                <LandPlotIcon class="size-4" />
                {m.common_sprint()}
              </Popover.Trigger>
            </>
          }
        />

        <Show when={props.assignableUsers}>
          <Popover placement="top" gutter={8}>
            <Popover.Trigger as={Button} variant="outline" size="xs">
              <UserIcon class="size-4" />
              {m.common_assignee()}
            </Popover.Trigger>
            <PickerPopover
              value={null}
              onChange={(value) => handleUpdate({ assignedToId: value as string | null })}
              options={assignableUsersOptions()}
            />
          </Popover>
        </Show>

        <DropdownMenu>
          <DropdownMenuTrigger as={Button} variant="outline" size="xs">
            {m.common_more()}
            <ChevronDownIcon class="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}>
              <TrashIcon class="size-4" />
              {m.common_delete()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteDialogOpen()} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia class="bg-destructive/50">
              <TrashIcon class="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {m.issue_selection_delete_title({ count: String(props.selectedIssues.length) })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.issue_selection_delete_description()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="xs">{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction size="xs" variant="destructive" action={handleDelete}>
              {m.common_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Show>
  );
}
