import type { ColorKey } from "@blackwall/database/schema";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";

export const badgeVariants = cva(
  "text-base font-medium rounded-full inline-flex flex-row gap-1 items-center !leading-none shadow-xs tabular-nums",
  {
    variants: {
      size: {
        xs: "text-xs px-1.5 py-1",
        sm: "text-sm px-1.5 py-1",
        md: "text-base px-2 py-1.5",
      },
      color: {
        normal: "bg-background text-foreground",
        red: "bg-theme-red/20 text-theme-red",
        blue: "bg-theme-blue/20 text-theme-blue",
        green: "bg-theme-green/20 text-theme-green",
        orange: "bg-theme-orange/20 text-theme-orange",
        pink: "bg-theme-pink/20 text-theme-pink",
        purple: "bg-theme-purple/20 text-theme-purple",
        teal: "bg-theme-teal/20 text-theme-teal",
        violet: "bg-theme-violet/20 text-theme-violet",
        yellow: "bg-theme-yellow/20 text-theme-yellow",
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
