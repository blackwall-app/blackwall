import { cn } from "@/lib/utils";
import { A } from "@solidjs/router";
import { For } from "solid-js";

type SegmentOption = {
  label: string;
  href: string;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  class?: string;
};

export function SegmentedControl(props: SegmentedControlProps) {
  return (
    <div class={cn("flex items-center rounded-md bg-muted p-0.5 text-xs font-medium", props.class)}>
      <For each={props.options}>
        {(option) => (
          <A
            href={option.href}
            activeClass="bg-background text-foreground shadow-xs"
            inactiveClass="text-muted-foreground hover:text-foreground"
            class="rounded px-2 py-0.5 transition-colors"
            end
          >
            {option.label}
          </A>
        )}
      </For>
    </div>
  );
}
