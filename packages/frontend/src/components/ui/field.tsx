import { createMemo, For, Show, splitProps, type ComponentProps, type JSX } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function FieldSet(props: ComponentProps<"fieldset">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <fieldset
      data-slot="field-set"
      class={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        local.class,
      )}
      {...rest}
    />
  );
}

function FieldLegend(props: ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  const variant = () => local.variant ?? "legend";

  return (
    <legend
      data-slot="field-legend"
      data-variant={variant()}
      class={cn(
        "mb-2 font-medium",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        local.class,
      )}
      {...rest}
    />
  );
}

function FieldGroup(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="field-group"
      class={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
        local.class,
      )}
      {...rest}
    />
  );
}

const fieldVariants = cva("group/field flex w-full gap-3 data-[invalid=true]:text-destructive", {
  variants: {
    orientation: {
      vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
      horizontal: [
        "flex-row items-center",
        "[&>[data-slot=field-label]]:flex-auto",
        "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      ],
      responsive: [
        "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
        "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
        "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      ],
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

function Field(props: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  const [local, rest] = splitProps(props, ["class", "orientation"]);
  const orientation = () => local.orientation ?? "vertical";

  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation()}
      class={cn(fieldVariants({ orientation: orientation() }), local.class)}
      {...rest}
    />
  );
}

function FieldContent(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="field-content"
      class={cn("group/field-content flex flex-1 flex-col gap-1.5 leading-snug", local.class)}
      {...rest}
    />
  );
}

function FieldLabel(props: ComponentProps<typeof Label>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Label
      data-slot="field-label"
      class={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
        "has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10",
        local.class,
      )}
      {...rest}
    />
  );
}

function FieldTitle(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="field-label"
      class={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50",
        local.class,
      )}
      {...rest}
    />
  );
}

function FieldDescription(props: ComponentProps<"p">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p
      data-slot="field-description"
      class={cn(
        "text-muted-foreground text-sm leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        local.class,
      )}
      {...rest}
    />
  );
}

function FieldSeparator(props: ComponentProps<"div"> & { children?: JSX.Element }) {
  const [local, rest] = splitProps(props, ["children", "class"]);
  return (
    <div
      data-slot="field-separator"
      data-content={!!local.children}
      class={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        local.class,
      )}
      {...rest}
    >
      <Separator class="absolute inset-0 top-1/2" />
      {local.children && (
        <span
          class="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {local.children}
        </span>
      )}
    </div>
  );
}

type FieldErrorProps = ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
};

function FieldError(props: FieldErrorProps) {
  const [local, rest] = splitProps(props, ["class", "children", "errors"]);

  const uniqueErrors = createMemo(() => {
    if (!local.errors?.length) return [];
    return [...new Map(local.errors.map((error) => [error?.message, error])).values()].filter(
      (e): e is { message?: string } => !!e?.message,
    );
  });

  const content = createMemo(() => {
    if (local.children) {
      return local.children;
    }

    const errors = uniqueErrors();
    if (!errors.length) {
      return null;
    }

    if (errors.length === 1) {
      return errors[0]?.message;
    }

    return (
      <ul class="ml-4 flex list-disc flex-col gap-1">
        <For each={errors}>{(error) => <li>{error.message}</li>}</For>
      </ul>
    );
  });

  return (
    <Show when={content()}>
      <div
        role="alert"
        data-slot="field-error"
        class={cn("text-destructive text-sm font-normal", local.class)}
        {...rest}
      >
        {content()}
      </div>
    </Show>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
