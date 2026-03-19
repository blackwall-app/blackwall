import { PickerPopover } from "@/components/custom-ui/picker-popover";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { action, reload, useAction } from "@solidjs/router";
import { Popover } from "@kobalte/core/popover";
import AlertCircleIcon from "lucide-solid/icons/alert-circle";
import ChevronsUpDownIcon from "lucide-solid/icons/chevrons-up-down";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import { createMemo, createSignal, Show, type JSX } from "solid-js";
import type { SerializedIssueSprint } from "@blackwall/database/schema";
import { m } from "@/paraglide/messages.js";

const updateSprint = action(async (issueKey: string, sprintId: string | null) => {
  await api.api.issues[`:issueKey`].$patch({
    param: { issueKey },
    json: { sprintId },
  });

  throw reload({ revalidate: ["issueShow", "board"] });
});

type SprintPickerPopoverProps = {
  sprintId?: string | null;
  openSprints: SerializedIssueSprint[];
  issueKey?: string;
  onChange?: (id: string | null) => Promise<void> | void;
  trigger?: JSX.Element;
};

export function SprintPickerPopover(props: SprintPickerPopoverProps) {
  const [open, setOpen] = createSignal(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = createSignal(false);
  const [pendingSprintId, setPendingSprintId] = createSignal<string | null>(null);
  const _update = useAction(updateSprint);

  const currentSprint = createMemo(() =>
    props.openSprints.find((sprint) => sprint.id === props.sprintId),
  );

  const sprintOptions = createMemo(() => {
    const options: Array<{
      id: string | null;
      label: string;
      icon: () => any;
    }> = [
      {
        id: null,
        label: m.issue_picker_no_sprint(),
        icon: () => <LandPlotIcon class="size-4 text-muted-foreground" />,
      },
    ];

    for (const sprint of props.openSprints) {
      options.push({
        id: sprint.id,
        label: sprint.name,
        icon: () => <LandPlotIcon class="size-4" />,
      });
    }

    return options;
  });

  const pendingSprint = createMemo(() =>
    props.openSprints.find((sprint) => sprint.id === pendingSprintId()),
  );

  const applyChange = async (id: string | null) => {
    if (props.onChange) {
      await props.onChange(id);
      return;
    }

    if (!props.issueKey) {
      return;
    }

    await _update(props.issueKey, id);
  };

  const handleChange = async (id: string | null) => {
    const nextSprint = props.openSprints.find((sprint) => sprint.id === id);
    const shouldConfirm = Boolean(
      nextSprint && nextSprint.status === "active" && props.sprintId !== id,
    );

    if (shouldConfirm) {
      setPendingSprintId(id);
      setConfirmDialogOpen(true);
      return;
    }

    await applyChange(id);
  };

  const handleConfirm = async () => {
    const id = pendingSprintId();
    if (!id) {
      return;
    }

    await applyChange(id);
    setPendingSprintId(null);
  };

  return (
    <>
      <Popover open={open()} onOpenChange={setOpen} placement="bottom-start" gutter={8}>
        <Show when={!props.trigger} fallback={props.trigger}>
          <Popover.Trigger
            class="flex flex-row gap-2 items-center text-base px-2!"
            as={Button}
            variant="outline"
            size="lg"
            scaleEffect={false}
          >
            {props.trigger ?? (
              <>
                <LandPlotIcon class="size-4" />
                {currentSprint()?.name ?? m.issue_picker_no_sprint()}
                <ChevronsUpDownIcon class="size-4" />
              </>
            )}
          </Popover.Trigger>
        </Show>

        <PickerPopover value={props.sprintId} onChange={handleChange} options={sprintOptions()} />
      </Popover>

      <AlertDialog
        open={confirmDialogOpen()}
        onOpenChange={(isOpen) => {
          setConfirmDialogOpen(isOpen);
          if (!isOpen) {
            setPendingSprintId(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia class="bg-muted">
              <AlertCircleIcon class="text-muted-foreground" />
            </AlertDialogMedia>
            <AlertDialogTitle>{m.issue_picker_add_to_active_sprint_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.issue_picker_add_to_active_sprint_description({
                sprintName: pendingSprint()?.name ?? m.issue_picker_this_sprint(),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="xs">{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction size="xs" action={handleConfirm}>
              {m.issue_picker_add_to_sprint_action()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
