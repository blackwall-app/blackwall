import { UserAvatar } from "@/components/custom-ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextField } from "@/components/ui/text-field";
import { api } from "@/lib/api";
import { query, createAsync, action, reload, useAction } from "@solidjs/router";
import { formatRelative } from "@/lib/dates";
import ClockIcon from "lucide-solid/icons/clock";
import EllipsisIcon from "lucide-solid/icons/ellipsis";
import PlusIcon from "lucide-solid/icons/plus";
import TrashIcon from "lucide-solid/icons/trash-2";
import { createSignal, For, onMount, Show } from "solid-js";
import type { InferDbType } from "@blackwall/database/types";
import { m } from "@/paraglide/messages.js";

type TimeEntryWithUser = InferDbType<
  "timeEntry",
  {
    user: {
      columns: {
        id: true;
        name: true;
        image: true;
      };
    };
  }
>;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseDurationInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const justMinutes = parseInt(trimmed, 10);
  if (!isNaN(justMinutes) && trimmed === String(justMinutes)) {
    return justMinutes;
  }

  let totalMinutes = 0;

  const decimalHourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (decimalHourMatch) {
    return Math.round(parseFloat(decimalHourMatch[1]) * 60);
  }

  const hoursMatch = trimmed.match(/(\d+)\s*h/);
  const minutesMatch = trimmed.match(/(\d+)\s*m/);

  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

const totalTimeLoader = query(async (issueKey: string) => {
  const res = await api.api.issues[`:issueKey`]["time-entries"].total.$get({
    param: { issueKey },
  });

  const { totalMinutes } = await res.json();
  return totalMinutes;
}, "timeEntryTotal");

const timeEntriesLoader = query(async (issueKey: string) => {
  const res = await api.api.issues[`:issueKey`]["time-entries"].$get({
    param: { issueKey },
  });

  const { entries } = await res.json();
  return entries;
}, "timeEntriesList");

const logTimeEntry = action(async (issueKey: string, duration: number, description?: string) => {
  await api.api.issues[`:issueKey`]["time-entries"].$post({
    param: { issueKey },
    json: { duration, description },
  });

  throw reload({ revalidate: ["timeEntryTotal", "timeEntriesList", "issueShow"] });
});

const deleteTimeEntry = action(async (issueKey: string, timeEntryId: string) => {
  await api.api.issues[`:issueKey`]["time-entries"][`:timeEntryId`].$delete({
    param: { issueKey, timeEntryId },
  });

  throw reload({ revalidate: ["timeEntryTotal", "timeEntriesList", "issueShow"] });
});

export function TimeEntryPickerPopover(props: { issueKey: string; workspaceSlug: string }) {
  const [logDialogOpen, setLogDialogOpen] = createSignal(false);
  const [historyDialogOpen, setHistoryDialogOpen] = createSignal(false);
  const [durationInput, setDurationInput] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const totalTime = createAsync(() => totalTimeLoader(props.issueKey));
  const timeEntries = createAsync(() => timeEntriesLoader(props.issueKey));

  const _logTime = useAction(logTimeEntry);

  const handleSubmit = async () => {
    const duration = parseDurationInput(durationInput());
    if (!duration || duration <= 0) return;

    setIsSubmitting(true);
    try {
      await _logTime(props.issueKey, duration, description() || undefined);

      setDurationInput("");
      setDescription("");
      setLogDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedDuration = () => parseDurationInput(durationInput());

  return (
    <div class="flex flex-col gap-1">
      <Dialog open={logDialogOpen()} onOpenChange={setLogDialogOpen}>
        <DialogTrigger
          as={Button}
          variant="outline"
          size="sm"
          class="min-w-16 justify-start font-normal gap-2 w-fit"
          data-testid="time-entry-log-trigger"
        >
          <ClockIcon class="size-4 text-muted-foreground" />
          <Show when={totalTime()} fallback="—">
            {(total) => <span>{formatDuration(total())}</span>}
          </Show>
        </DialogTrigger>

        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.time_entry_log_title()}</DialogTitle>
          </DialogHeader>

          <div class="flex flex-col gap-4">
            <TextField value={durationInput()} onChange={setDurationInput}>
              <TextField.Label>{m.time_entry_duration_label()}</TextField.Label>
              <TextField.Input
                placeholder={m.time_entry_duration_placeholder()}
                data-testid="time-entry-duration-input"
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === "Enter" && parsedDuration()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Show when={parsedDuration()}>
                {(duration) => (
                  <p class="text-sm text-muted-foreground">{formatDuration(duration())}</p>
                )}
              </Show>
            </TextField>

            <TextField value={description()} onChange={setDescription}>
              <TextField.Label>{m.time_entry_description_optional_label()}</TextField.Label>
              <TextField.TextArea
                placeholder={m.time_entry_description_placeholder()}
                rows={2}
                data-testid="time-entry-description-input"
              />
            </TextField>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              disabled={!parsedDuration() || isSubmitting()}
              onClick={handleSubmit}
              data-testid="time-entry-log-submit"
            >
              <PlusIcon class="size-4" />
              {m.time_entry_log_title()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen()} onOpenChange={setHistoryDialogOpen}>
        <DialogTrigger
          as={Button}
          variant="link"
          size="xxs"
          class="justify-start px-0 h-auto w-fit"
          data-testid="time-entry-history-trigger"
        >
          {m.time_entry_history_button()}
        </DialogTrigger>

        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.time_entry_history_title()}</DialogTitle>
          </DialogHeader>

          <Show
            when={timeEntries() && timeEntries()!.length > 0}
            fallback={
              <p class="text-sm text-muted-foreground py-4 text-center">
                {m.time_entry_history_empty()}
              </p>
            }
          >
            <div class="flex flex-col gap-2 max-h-80 overflow-y-auto">
              <For each={timeEntries()}>
                {(entry) => (
                  <TimeEntryItem
                    entry={entry}
                    issueKey={props.issueKey}
                    workspaceSlug={props.workspaceSlug}
                  />
                )}
              </For>
            </div>
          </Show>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimeEntryItem(props: {
  entry: TimeEntryWithUser;
  issueKey: string;
  workspaceSlug: string;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [relativeTime, setRelativeTime] = createSignal<string>("");

  onMount(() => {
    setRelativeTime(formatRelative(new Date(props.entry.createdAt), new Date()));
  });

  const _deleteEntry = useAction(deleteTimeEntry);

  const handleDelete = async () => {
    await _deleteEntry(props.issueKey, props.entry.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        class="flex items-center gap-2 p-2 rounded-md hover:bg-accent group"
        data-testid="time-entry-item"
      >
        <UserAvatar user={props.entry.user} size="xs" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">{formatDuration(props.entry.duration)}</span>
            <span class="text-xs text-muted-foreground">{relativeTime()}</span>
          </div>
          <Show when={props.entry.description}>
            <p class="text-xs text-muted-foreground truncate">{props.entry.description}</p>
          </Show>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            as={Button}
            variant="ghost"
            size="iconXs"
            class="opacity-0 group-hover:opacity-100"
            aria-label={m.common_more()}
          >
            <EllipsisIcon class="size-4" />
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
            <AlertDialogTitle>{m.time_entry_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.time_entry_delete_description({ duration: formatDuration(props.entry.duration) })}
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
    </>
  );
}
