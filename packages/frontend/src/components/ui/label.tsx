import * as Solid from "solid-js";
import { cn } from "@/lib/utils";

export const labelClasses =
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

export const Label = (props: Solid.ComponentProps<"label">) => {
  const [local, rest] = Solid.splitProps(props, ["class"]);

  return <label class={cn(labelClasses, local.class)} {...rest} />;
};
