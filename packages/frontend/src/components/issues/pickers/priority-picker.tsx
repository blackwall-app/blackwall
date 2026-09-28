import { PickerPopover } from "@/components/custom-ui/picker-popover";
import type { IssuePriority } from "@blackwall/shared";
import { issueMappings, mappingToOptionArray } from "@/lib/mappings";
import { Popover } from "@kobalte/core/popover";
import { IssuePriorityBadge } from "../issue-badges";
import { runApi } from "@/lib/api-effect";
import { toast } from "@/components/custom-ui/toast";
import { action, reload, useAction } from "@solidjs/router";
import { m } from "@/paraglide/messages.js";

const updatePriorityAction = action(async (issueKey: string, priority: IssuePriority) => {
  await runApi((client) => client.issues.update({ params: { issueKey }, payload: { priority } }));

  toast.success(m.issue_priority_picker_toast_updated());
  throw reload({ revalidate: ["issueShow"] });
});

export function PriorityPickerPopover(props: {
  priority: IssuePriority;
  issueKey: string;
  workspaceSlug: string;
}) {
  const _action = useAction(updatePriorityAction);
  const handleChange = async (priority: IssuePriority) => _action(props.issueKey, priority);

  return (
    <Popover placement="bottom-start" gutter={8}>
      <Popover.Trigger class="rounded-full [&>span]:hover:bg-accent">
        <IssuePriorityBadge priority={props.priority} />
      </Popover.Trigger>

      <PickerPopover
        value={props.priority}
        onChange={handleChange}
        options={mappingToOptionArray(issueMappings.priority)}
      />
    </Popover>
  );
}
