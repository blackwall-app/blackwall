import { cn } from "@/lib/utils";
import { Checkbox as CheckboxPrimitive } from "@kobalte/core/checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-solid/icons/check";
import { type ComponentProps, splitProps } from "solid-js";

const checkboxControlVariants = cva(
  "border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
  {
    variants: {
      size: {
        default: "size-5 rounded-md",
        sm: "size-4 rounded-sm",
      },
      visibility: {
        default: "border-border bg-muted",
        outline: "border-border bg-transparent hover:border-primary",
        ghost:
          "border-transparent bg-transparent data-[checked]:border-primary group-hover/row:border-border",
      },
    },
    defaultVariants: {
      size: "default",
      visibility: "default",
    },
  },
);

const checkboxIconVariants = cva("", {
  variants: {
    size: {
      default: "size-4",
      sm: "size-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type CheckboxProps = ComponentProps<typeof CheckboxPrimitive> &
  VariantProps<typeof checkboxControlVariants>;

function Checkbox(props: CheckboxProps) {
  const [local, rest] = splitProps(props, ["class", "size", "visibility"]);
  return (
    <CheckboxPrimitive
      class={cn("inline-flex items-center checkbox__root", local.class)}
      role="checkbox"
      {...rest}
    >
      <CheckboxPrimitive.Input class="checkbox__input" />
      <CheckboxPrimitive.Control
        class={checkboxControlVariants({
          size: local.size,
          visibility: local.visibility,
        })}
      >
        <CheckboxPrimitive.Indicator class="flex items-center justify-center size-full">
          <CheckIcon class={checkboxIconVariants({ size: local.size })} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
    </CheckboxPrimitive>
  );
}

export { Checkbox, checkboxControlVariants };
