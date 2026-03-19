import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as Solid from "solid-js";

export const inputVariants = cva("", {
  variants: {
    variant: {
      default:
        "file:text-foreground bg-input rounded-sm placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
      unstyled: "outline-none placeholder:text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const Input = (
  props: Solid.ComponentProps<"input"> & VariantProps<typeof inputVariants>,
) => {
  const [local, rest] = Solid.splitProps(props, ["class", "variant"]);

  return <input class={cn(inputVariants({ variant: local.variant }), local.class)} {...rest} />;
};
