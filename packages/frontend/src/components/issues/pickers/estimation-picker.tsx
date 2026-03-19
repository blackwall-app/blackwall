import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { action, reload, useAction } from "@solidjs/router";
import { Popover } from "@kobalte/core/popover";
import { createSignal, For } from "solid-js";
import { m } from "@/paraglide/messages.js";

const ESTIMATION_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

const updateEstimation = action(async (issueKey: string, points: number | null) => {
  await api.api.issues[`:issueKey`].$patch({
    param: { issueKey },
    json: { estimationPoints: points },
  });

  throw reload({ revalidate: ["issueShow"] });
});

export function EstimationPickerPopover(props: {
  estimationPoints: number | null;
  issueKey: string;
  workspaceSlug: string;
}) {
  const [open, setOpen] = createSignal(false);
  const _update = useAction(updateEstimation);

  const handleChange = async (points: number | null) => {
    setOpen(false);
    _update(props.issueKey, points);
  };

  return (
    <Popover placement="bottom-start" gutter={8} open={open()} onOpenChange={setOpen}>
      <Popover.Trigger
        as={Button}
        variant="outline"
        size="sm"
        class="min-w-16 justify-start font-normal"
      >
        {props.estimationPoints === null
          ? "—"
          : `${props.estimationPoints} ${m.issue_estimation_points({ count: String(props.estimationPoints) })}`}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content class="z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-32">
          <div class="flex flex-col">
            <For each={ESTIMATION_OPTIONS}>
              {(points) => (
                <button
                  type="button"
                  class="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-accent text-left"
                  classList={{ "bg-accent": props.estimationPoints === points }}
                  onClick={() => handleChange(points)}
                >
                  {points} {m.issue_estimation_points({ count: String(points) })}
                </button>
              )}
            </For>
            <div class="border-t my-1" />
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-accent text-left text-muted-foreground"
              onClick={() => handleChange(null)}
            >
              {m.common_clear()}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
