import { cva, type VariantProps } from "class-variance-authority";
import { mergeProps, splitProps, type ComponentProps } from "solid-js";

import { cn } from "@/lib/utils";

function Empty(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="empty"
      class={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        local.class,
      )}
      {...others}
    />
  );
}

function EmptyHeader(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="empty-header"
      class={cn("flex max-w-sm flex-col items-center gap-2 text-center", local.class)}
      {...others}
    />
  );
}

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function EmptyMedia(props: ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  const merged = mergeProps({ variant: "default" as const }, props);
  const [local, others] = splitProps(merged, ["class", "variant"]);

  return (
    <div
      data-slot="empty-icon"
      data-variant={local.variant}
      class={cn(emptyMediaVariants({ variant: local.variant, className: local.class }))}
      {...others}
    />
  );
}

function EmptyTitle(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="empty-title"
      class={cn("text-lg font-medium tracking-tight", local.class)}
      {...others}
    />
  );
}

function EmptyDescription(props: ComponentProps<"p">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="empty-description"
      class={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        local.class,
      )}
      {...others}
    />
  );
}

function EmptyContent(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="empty-content"
      class={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        local.class,
      )}
      {...others}
    />
  );
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
