import type { ColorKey } from "@blackwall/database/schema";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";

export const badgeVariants = cva(
  "px-2 py-1 text-base font-medium rounded-full inline-flex flex-row gap-1 items-center !leading-none shadow-xs tabular-nums",
  {
    variants: {
      size: {
        xs: "text-xs px-1.5 py-1",
        sm: "text-sm px-1.5 py-1",
        md: "text-base px-2 py-1.5",
      },
      color: {
        normal: "bg-background text-foreground ring-1 ring-foreground/10 ring-inset",
        red: "bg-theme-red text-background ring-1 ring-foreground/10 ring-inset",
        blue: "bg-theme-blue text-background ring-1 ring-foreground/10 ring-inset",
        green: "bg-theme-green text-background ring-1 ring-foreground/10 ring-inset",
        orange: "bg-theme-orange text-background ring-1 ring-foreground/10 ring-inset",
        pink: "bg-theme-pink text-background ring-1 ring-foreground/10 ring-inset",
        purple: "bg-theme-purple text-background ring-1 ring-foreground/10 ring-inset",
        teal: "bg-theme-teal text-background ring-1 ring-foreground/10 ring-inset",
        violet: "bg-theme-violet text-background ring-1 ring-foreground/10 ring-inset",
        yellow: "bg-theme-yellow text-background ring-1 ring-foreground/10 ring-inset",
      } satisfies Record<ColorKey | "normal", string>,
    },
    defaultVariants: {
      color: "normal",
      size: "md",
    },
  },
);

export function Badge(props: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  const [local, rest] = splitProps(props, ["class", "color", "size"]);

  return (
    <span
      class={cn(badgeVariants({ color: local.color, size: local.size }), local.class)}
      {...rest}
    />
  );
}
