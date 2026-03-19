import { cn } from "@/lib/utils";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { ScrollArea } from "../custom-ui/scroll-area";
import { A, type AnchorProps } from "@solidjs/router";

type DataTableRootProps = {
  children?: JSX.Element;
  class?: string;
};

function DataTableRoot(props: DataTableRootProps) {
  return (
    <ScrollArea
      class={cn("flex-1 min-h-0", props.class)}
      viewportClass="grid min-w-full min-h-0 flex-1 auto-rows-min"
    >
      {props.children}
    </ScrollArea>
  );
}

type DataTableGridProps = ComponentProps<"div"> & {
  gridTemplateColumns?: string;
};

function DataTableGrid(props: DataTableGridProps) {
  const [local, rest] = splitProps(props, ["class", "style", "gridTemplateColumns"]);
  return (
    <div
      data-slot="table-grid"
      class={cn("grid auto-rows-min text-sm min-w-full ", local.class)}
      style={{
        ...(typeof local.style === "object" ? local.style : {}),
        "grid-template-columns": local.gridTemplateColumns,
      }}
      {...rest}
    />
  );
}

function DataTableFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="table-footer"
      class={cn("bg-muted/50 border-t font-medium [&>div]:last:border-b-0", local.class)}
      {...rest}
    />
  );
}

const rowClass =
  "group/row hover:bg-muted/50 data-[state=selected]:bg-muted/50 border-b grid grid-cols-subgrid col-span-full";

function DataTableRow(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div data-slot="table-row" class={cn(rowClass, local.class)} {...rest} />;
}

function DataTableLinkRow(props: AnchorProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return <A class={cn(rowClass, local.class)} {...rest} />;
}

function DataTableHead(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="table-head"
      class={cn(
        "grid border-b col-span-full grid-cols-subgrid text-muted-foreground text-left whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        local.class,
      )}
      {...rest}
    />
  );
}

function DataTableCell(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="table-cell"
      class={cn(
        "px-2 h-10 first:pl-6 last:pr-6 flex flex-row items-center whitespace-nowrap overflow-hidden text-ellipsis [&:has([role=checkbox])]:pl-3",
        local.class,
      )}
      {...rest}
    />
  );
}

function DataTableHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="table-header"
      class={cn(
        "py-1.5 px-2 first:pl-6 last:pr-6 text-xs whitespace-nowrap overflow-hidden text-ellipsis [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        local.class,
      )}
      {...rest}
    />
  );
}

export {
  DataTableRoot,
  DataTableGrid,
  DataTableFooter,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableLinkRow,
  DataTableCell,
};
