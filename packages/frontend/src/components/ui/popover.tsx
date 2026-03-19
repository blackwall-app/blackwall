import type { Component, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as PopoverPrimitive from "@kobalte/core/popover";

import { cn } from "@/lib/utils";

const PopoverTrigger = PopoverPrimitive.Trigger;

const Popover: Component<PopoverPrimitive.PopoverRootProps> = (props) => {
  return <PopoverPrimitive.Root gutter={4} {...props} />;
};

type PopoverContentProps<T extends ValidComponent = "div"> =
  PopoverPrimitive.PopoverContentProps<T> & { class?: string | undefined };

const PopoverContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, PopoverContentProps<T>>,
) => {
  const [local, others] = splitProps(props as PopoverContentProps, ["class"]);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        class={cn(
          "bg-popover text-popover-foreground data-expanded:animate-in ease-out duration-200 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-side=bottom:slide-in-from-top-2 data-side=left:slide-in-from-right-2 data-side=right:slide-in-from-left-2 data-side=top:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) squircle-md border p-4 shadow-md outline-hidden",
          local.class,
        )}
        {...others}
      />
    </PopoverPrimitive.Portal>
  );
};

export { Popover, PopoverTrigger, PopoverContent };
