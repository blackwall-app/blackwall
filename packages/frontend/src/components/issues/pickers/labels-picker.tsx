import { Badge } from "@/components/custom-ui/badge";
import { type PickerOption } from "@/components/custom-ui/picker";
import { PickerPopover } from "@/components/custom-ui/picker-popover";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Popover } from "@kobalte/core/popover";
import PlusIcon from "lucide-solid/icons/plus";
import { createResource, createSignal, Index } from "solid-js";
import { action, reload, useAction } from "@solidjs/router";
import type { SerializedLabel } from "@blackwall/database/schema";
import { m } from "@/paraglide/messages.js";

const createAndAddLabel = action(async (name: string, issueKey: string) => {
  const createRes = await api.api.labels.$post({
    json: { name },
  });
  const { label } = await createRes.json();
  await api.api.issues[`:issueKey`].labels.$post({
    param: { issueKey },
    json: { labelId: label.id },
  });

  throw reload({ revalidate: ["issueShow"] });
});

const addLabel = action(async (labelId: string, issueKey: string) => {
  await api.api.issues[`:issueKey`].labels.$post({
    param: { issueKey },
    json: { labelId },
  });

  throw reload({ revalidate: ["issueShow"] });
});

const removeLabel = action(async (labelId: string, issueKey: string) => {
  await api.api.issues[`:issueKey`].labels[`:labelId`].$delete({
    param: { issueKey, labelId },
  });

  throw reload({ revalidate: ["issueShow"] });
});

export function IssueLabelsPicker(props: { labels: SerializedLabel[]; issueKey: string }) {
  const [addOpen, setAddOpen] = createSignal(false);

  const labelIds = () => props.labels.map((label) => label.id);

  const _createAndAdd = useAction(createAndAddLabel);
  const _add = useAction(addLabel);
  const _remove = useAction(removeLabel);

  const [allLabels] = createResource(
    () => addOpen() === true,
    async () => {
      const res = await api.api.labels.$get();
      const { labels } = await res.json();
      return labels.map(
        (label) =>
          ({
            id: label.id,
            label: label.name,
          }) satisfies PickerOption,
      );
    },
  );

  const handleCreateNewLabel = async (name: string) => {
    _createAndAdd(name, props.issueKey);
  };

  const handleAddExistingLabel = async (id: string) => {
    _add(id, props.issueKey);
  };

  const handleRemoveLabel = async (id: string) => {
    _remove(id, props.issueKey);
  };

  function handleChange(id: string) {
    if (labelIds().includes(id)) {
      handleRemoveLabel(id);
    } else {
      handleAddExistingLabel(id);
    }
  }

  let savedAnchorRect: DOMRect | null = null;

  function handleAnchorRect(anchor?: HTMLElement) {
    if (savedAnchorRect) {
      return savedAnchorRect;
    }

    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      savedAnchorRect = rect;
      return rect;
    }
  }

  function handleSetOpen(value: boolean) {
    if (!value) {
      savedAnchorRect = null;
    }
    setAddOpen(value);
  }

  return (
    <div class="flex flex-wrap gap-y-2 gap-x-1 items-center">
      <Index each={props.labels}>
        {(label) => (
          <Badge color={label().colorKey} data-testid="issue-label-badge">
            {label().name}
          </Badge>
        )}
      </Index>

      <Popover
        placement="left-start"
        gutter={8}
        open={addOpen()}
        onOpenChange={handleSetOpen}
        getAnchorRect={handleAnchorRect}
      >
        <Popover.Trigger
          class="text-muted-foreground hover:text-foreground transition-colors rounded-full size-6"
          as={Button}
          variant="ghost"
          size="sm"
          aria-label={m.issue_labels_picker_create_label()}
          data-testid="issue-labels-picker-trigger"
        >
          <PlusIcon class="size-4" />
        </Popover.Trigger>

        <PickerPopover
          multiple
          createNew
          options={allLabels() ?? []}
          value={labelIds()}
          loading={allLabels.loading}
          emptyText={m.issue_labels_picker_empty_text()}
          createNewLabel={m.issue_labels_picker_create_label()}
          onCreateNew={handleCreateNewLabel}
          onChange={handleChange}
        />
      </Popover>
    </div>
  );
}
