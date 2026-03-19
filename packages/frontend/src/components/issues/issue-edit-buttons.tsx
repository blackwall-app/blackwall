import { Show, type Component } from "solid-js";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Button } from "../ui/button";
import CheckIcon from "lucide-solid/icons/check";
import XIcon from "lucide-solid/icons/x";
import { m } from "@/paraglide/messages.js";

type IssueEditButtonsProps = {
  isEditing: boolean;
  onSave: (e: MouseEvent) => void | Promise<void>;
  onCancel: (e: MouseEvent) => void;
};

export const IssueEditButtons: Component<IssueEditButtonsProps> = (props) => {
  return (
    <Show when={props.isEditing}>
      <div
        class="flex flex-row gap-2 absolute -bottom-11 left-0 z-100 bg-muted p-1 border rounded-md"
        onPointerDown={(e) => e.preventDefault()} // prevent blurring when clicking the buttons
      >
        <Tooltip>
          <TooltipTrigger as="div">
            <Button
              size="iconXs"
              variant="default"
              aria-label={m.common_save()}
              data-testid="issue-edit-save"
              onClick={props.onSave}
            >
              <CheckIcon class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{m.common_save()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as="div">
            <Button
              size="iconXs"
              variant="outline"
              aria-label={m.common_cancel()}
              data-testid="issue-edit-cancel"
              onClick={props.onCancel}
            >
              <XIcon class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{m.common_cancel()}</TooltipContent>
        </Tooltip>
      </div>
    </Show>
  );
};
