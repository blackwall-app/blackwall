import { cn } from "@/lib/utils";
import { splitProps, type JSX } from "solid-js";
import { ScrollArea as ScrollAreaPrimitive } from "rigid-ui/scroll-area";

export function ScrollContainer(props: {
  children?: JSX.Element;
  class?: string;
  scrollAreaClass?: string;
}) {
  const [local, rest] = splitProps(props, ["children", "class", "scrollAreaClass"]);

  return (
    <div class={cn("relative flex min-h-0 h-full w-full flex-1 flex-col", local.class)} {...rest}>
      <ScrollArea rootClass="flex-1 min-h-0" class={local.scrollAreaClass}>
        {local.children}
      </ScrollArea>
    </div>
  );
}

type ScrollAreaProps = {
  children?: JSX.Element;
  class?: string;
  rootClass?: string;
  viewportClass?: string;
  viewportRef?: HTMLDivElement | ((el: HTMLDivElement) => void);
};

export function ScrollArea(props: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root class={props.rootClass}>
      <ScrollAreaPrimitive.Viewport class={props.viewportClass} ref={props.viewportRef}>
        {props.children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar class="m-1 flex w-1 justify-center rounded bg-transparent opacity-0 transition-opacity pointer-events-none data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[hovering]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0 data-[scrolling]:pointer-events-auto">
        <ScrollAreaPrimitive.Thumb class="w-full rounded bg-black/20 dark:bg-white/20" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
