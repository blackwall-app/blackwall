import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import type {
  SerializedIssueSprint,
  SerializedLabel,
  SerializedUser,
} from "@blackwall/database/schema";
import type { InferDbType } from "@blackwall/database/types";
import { m } from "@/paraglide/messages.js";
import type { JSX } from "solid-js";
import {
  AssigneePickerPopover,
  EstimationPickerPopover,
  IssueLabelsPicker,
  SprintPickerPopover,
  PriorityPickerPopover,
  StatusPickerPopover,
  TimeEntryPickerPopover,
} from "./pickers";

type IssueForSidebar = InferDbType<"issue", { assignedTo: true }>;

function IssueSidebarItem(props: {
  children: JSX.Element;
  label: string;
  orientation: "row" | "col";
}) {
  return (
    <div
      class="flex w-full p-4 border-b"
      classList={{
        "flex-row items-center justify-between gap-4": props.orientation === "row",
        "flex-col gap-3": props.orientation === "col",
      }}
    >
      <p class="font-medium text-muted-foreground uppercase text-xs tracking-wide">{props.label}</p>
      <div>{props.children}</div>
    </div>
  );
}

export function IssueSidebar(props: {
  issue: IssueForSidebar;
  labels: SerializedLabel[];
  assignableUsers: SerializedUser[];
  openSprints: SerializedIssueSprint[];
  workspaceSlug: string;
  teamKey: string;
}) {
  return (
    <Sidebar side="right" class="top-10">
      <SidebarContent class="p-0 overflow-hidden">
        <ScrollContainer>
          <IssueSidebarItem label={m.issue_sidebar_label_status()} orientation="col">
            <StatusPickerPopover status={props.issue.status} issueKey={props.issue.key} />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_priority()} orientation="col">
            <PriorityPickerPopover
              priority={props.issue.priority}
              issueKey={props.issue.key}
              workspaceSlug={props.workspaceSlug}
            />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_estimate()} orientation="col">
            <EstimationPickerPopover
              estimationPoints={props.issue.estimationPoints}
              issueKey={props.issue.key}
              workspaceSlug={props.workspaceSlug}
            />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_time_logged()} orientation="col">
            <TimeEntryPickerPopover
              issueKey={props.issue.key}
              workspaceSlug={props.workspaceSlug}
            />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_assigned_to()} orientation="col">
            <AssigneePickerPopover
              assignedToId={props.issue.assignedToId}
              issueKey={props.issue.key}
              workspaceSlug={props.workspaceSlug}
              teamKey={props.teamKey}
              assignableUsers={props.assignableUsers}
            />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_labels()} orientation="col">
            <IssueLabelsPicker labels={props.labels} issueKey={props.issue.key} />
          </IssueSidebarItem>

          <IssueSidebarItem label={m.issue_sidebar_label_sprint()} orientation="col">
            <SprintPickerPopover
              sprintId={props.issue.sprintId}
              openSprints={props.openSprints}
              issueKey={props.issue.key}
            />
          </IssueSidebarItem>
        </ScrollContainer>
      </SidebarContent>
    </Sidebar>
  );
}
