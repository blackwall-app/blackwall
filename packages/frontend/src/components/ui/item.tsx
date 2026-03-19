import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, mergeProps, splitProps } from "solid-js";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const itemVariants = cva("flex w-full items-center gap-3 text-sm transition-colors", {
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "rounded-lg border bg-transparent p-3",
      muted: "rounded-lg bg-muted/50 p-3",
    },
    size: {
      default: "",
      sm: "gap-2 text-xs",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type ItemProps = ComponentProps<"div"> & VariantProps<typeof itemVariants>;

function Item(props: ItemProps) {
  const merged = mergeProps({ variant: "default", size: "default" } as const, props);
  const [local, rest] = splitProps(merged, ["class", "variant", "size"]);

  return (
    <div
      data-slot="item"
      class={cn(itemVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
}

function ItemContent(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="item-content"
      class={cn("flex min-w-0 flex-1 flex-col gap-0.5", local.class)}
      {...rest}
    />
  );
}

function ItemTitle(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <div data-slot="item-title" class={cn("font-medium leading-none", local.class)} {...rest} />
  );
}

function ItemDescription(props: ComponentProps<"p">) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <p
      data-slot="item-description"
      class={cn("text-muted-foreground text-xs leading-snug", local.class)}
      {...rest}
    />
  );
}

const itemMediaVariants = cva("flex shrink-0 items-center justify-center", {
  variants: {
    variant: {
      default: "",
      icon: "text-muted-foreground [&>svg]:size-4",
      image: "overflow-hidden rounded-md",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type ItemMediaProps = ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>;

function ItemMedia(props: ItemMediaProps) {
  const merged = mergeProps({ variant: "default" } as const, props);
  const [local, rest] = splitProps(merged, ["class", "variant"]);

  return (
    <div
      data-slot="item-media"
      class={cn(itemMediaVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}

function ItemActions(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="item-actions"
      class={cn("flex shrink-0 items-center gap-1", local.class)}
      {...rest}
    />
  );
}

function ItemHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);

  return <div data-slot="item-header" class={cn("w-full", local.class)} {...rest} />;
}

function ItemFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="item-footer"
      class={cn("flex w-full items-center gap-2 text-xs text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

const itemGroupVariants = cva("flex flex-col", {
  variants: {
    variant: {
      default: "gap-1",
      outline: "gap-0 divide-y rounded-lg border",
      muted: "gap-0 divide-y rounded-lg bg-muted/50",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type ItemGroupProps = ComponentProps<"div"> & VariantProps<typeof itemGroupVariants>;

function ItemGroup(props: ItemGroupProps) {
  const merged = mergeProps({ variant: "default" } as const, props);
  const [local, rest] = splitProps(merged, ["class", "variant"]);

  return (
    <div
      data-slot="item-group"
      data-variant={local.variant}
      class={cn(itemGroupVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}

function ItemSeparator(props: ComponentProps<typeof Separator>) {
  const [local, rest] = splitProps(props, ["class"]);

  return <Separator data-slot="item-separator" class={cn("-mx-px", local.class)} {...rest} />;
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
