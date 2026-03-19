import * as hoverCard from "@zag-js/hover-card";
import { normalizeProps, useMachine } from "@zag-js/solid";
import {
  createContext,
  createMemo,
  createUniqueId,
  useContext,
  splitProps,
  type ParentProps,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { cn } from "@/lib/utils";

type HoverCardApi = ReturnType<typeof hoverCard.connect>;

const HoverCardContext = createContext<() => HoverCardApi>();

const useHoverCard = () => {
  const context = useContext(HoverCardContext);
  if (!context) {
    throw new Error("useHoverCard must be used within a HoverCard");
  }
  return context;
};

type HoverCardProps = ParentProps<{
  openDelay?: number;
  closeDelay?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

function HoverCard(props: HoverCardProps) {
  const [local] = splitProps(props, [
    "children",
    "openDelay",
    "closeDelay",
    "defaultOpen",
    "open",
    "onOpenChange",
  ]);

  const service = useMachine(hoverCard.machine, () => ({
    id: createUniqueId(),
    openDelay: local.openDelay ?? 700,
    closeDelay: local.closeDelay ?? 300,
    defaultOpen: local.defaultOpen,
    open: local.open,
    onOpenChange: (details) => local.onOpenChange?.(details.open),
  }));

  const api = createMemo(() => hoverCard.connect(service, normalizeProps));

  return <HoverCardContext.Provider value={api}>{local.children}</HoverCardContext.Provider>;
}

type HoverCardTriggerProps = ParentProps<{
  class?: string;
  asChild?: boolean;
}>;

function HoverCardTrigger(props: HoverCardTriggerProps) {
  const api = useHoverCard();
  const [local, rest] = splitProps(props, ["children", "class", "asChild"]);

  return (
    <span {...api().getTriggerProps()} class={cn(local.class)} {...rest}>
      {local.children}
    </span>
  );
}

type HoverCardContentProps = ParentProps<{
  class?: string;
}>;

function HoverCardContent(props: HoverCardContentProps) {
  const api = useHoverCard();
  const [local, rest] = splitProps(props, ["children", "class"]);

  return (
    <Show when={api().open}>
      <Portal>
        <div {...api().getPositionerProps()}>
          <div
            {...api().getContentProps()}
            class={cn(
              "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              local.class,
            )}
            {...rest}
          >
            {local.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}

type HoverCardArrowProps = {
  class?: string;
};

function HoverCardArrow(props: HoverCardArrowProps) {
  const api = useHoverCard();

  return (
    <div {...api().getArrowProps()} class={cn("z-50", props.class)}>
      <div {...api().getArrowTipProps()} class="size-2.5 rotate-45 border bg-popover" />
    </div>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow, useHoverCard };
