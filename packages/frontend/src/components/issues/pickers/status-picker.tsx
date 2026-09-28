import { PickerPopover } from "@/components/custom-ui/picker-popover";
import type { IssueStatus } from "@blackwall/shared";
import { issueMappings, mappingToOptionArray } from "@/lib/mappings";
import { Popover } from "@kobalte/core/popover";
import { action, reload, useAction } from "@solidjs/router";
import { runApi } from "@/lib/api-effect";
import { IssueStatusBadge } from "../issue-badges";
import type { JSX } from "solid-js";
import { m } from "@/paraglide/messages.js";

const updateStatus = action(async (issueKey: string, status: IssueStatus) => {
  await runApi((client) => client.issues.update({ params: { issueKey }, payload: { status } }));

  throw reload({ revalidate: ["issueShow", "issues", "backlogIssues"] });
});

type StatusPickerPopoverProps =
  | {
      status: IssueStatus;
      controlled: true;
      onChange: (status: IssueStatus) => void;
      issueKey?: never;
      trigger?: JSX.Element;
    }
  | {
      status: IssueStatus;
      controlled?: false;
      issueKey: string;
      onChange?: never;
      trigger?: JSX.Element;
    };

export function StatusPickerPopover(props: StatusPickerPopoverProps) {
  const _updateStatus = useAction(updateStatus);

  const handleChange = async (status: IssueStatus) => {
    if (props.controlled && props.onChange) {
      props.onChange(status);
      return;
    }

    if (!props.controlled && props.issueKey) {
      _updateStatus(props.issueKey, status);
    }
  };

  return (
    <Popover placement="bottom-start" gutter={8}>
      <Popover.Trigger
        class="rounded-full hover:[&>span]:bg-accent"
        aria-label={m.issue_sidebar_label_status()}
        aria-haspopup="listbox"
      >
        {props.trigger ?? <IssueStatusBadge status={props.status} />}
      </Popover.Trigger>

      <PickerPopover
        value={props.status}
        onChange={handleChange}
        options={mappingToOptionArray(issueMappings.status)}
      />
    </Popover>
  );
}
