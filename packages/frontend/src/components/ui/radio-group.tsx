import * as radio from "@zag-js/radio-group";
import { normalizeProps, useMachine } from "@zag-js/solid";
import {
  createContext,
  createMemo,
  createUniqueId,
  useContext,
  splitProps,
  type ParentProps,
} from "solid-js";
import { cn } from "@/lib/utils";

type RadioGroupApi = ReturnType<typeof radio.connect>;

const RadioGroupContext = createContext<() => RadioGroupApi>();

const useRadioGroup = () => {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("useRadioGroup must be used within a RadioGroup");
  }
  return context;
};

type RadioGroupProps<T extends string> = ParentProps<{
  defaultValue?: T;
  value?: T;
  onValueChange?: (value: T) => void;
  name?: string;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  class?: string;
}>;

function RadioGroup<T extends string>(props: RadioGroupProps<T>) {
  const [local, rest] = splitProps(props, [
    "children",
    "defaultValue",
    "value",
    "onValueChange",
    "name",
    "disabled",
    "orientation",
    "class",
  ]);

  const service = useMachine(radio.machine, () => ({
    id: createUniqueId(),
    defaultValue: local.defaultValue,
    value: local.value,
    onValueChange: (details) =>
      details.value ? local.onValueChange?.(details.value as T) : undefined,
    name: local.name,
    disabled: local.disabled,
    orientation: local.orientation,
  }));

  const api = createMemo(() => radio.connect(service, normalizeProps));

  return (
    <RadioGroupContext.Provider value={api}>
      <div {...api().getRootProps()} class={cn("grid gap-3", local.class)} {...rest}>
        {local.children}
      </div>
    </RadioGroupContext.Provider>
  );
}

type RadioGroupItemProps = {
  value: string;
  id?: string;
  disabled?: boolean;
  class?: string;
};

function RadioGroupItem(props: RadioGroupItemProps) {
  const api = useRadioGroup();

  return (
    <div
      {...api().getItemProps({ value: props.value, disabled: props.disabled })}
      data-slot="radio-group-item"
      class={cn(
        "border-border text-primary focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-[3px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        props.class,
      )}
    >
      <input
        {...api().getItemHiddenInputProps({ value: props.value })}
        id={props.id ?? createUniqueId()}
      />
      <div
        {...api().getItemControlProps({ value: props.value })}
        data-slot="radio-group-indicator"
        class="relative flex size-full items-center justify-center"
      >
        <div
          class="bg-primary size-2 rounded-full opacity-0 data-[state=checked]:opacity-100"
          data-state={api().value === props.value ? "checked" : "unchecked"}
        />
      </div>
    </div>
  );
}

type RadioGroupLabelProps = ParentProps<{
  class?: string;
}>;

function RadioGroupLabel(props: RadioGroupLabelProps) {
  const api = useRadioGroup();

  return (
    <span {...api().getLabelProps()} class={cn("text-sm font-medium", props.class)}>
      {props.children}
    </span>
  );
}

type RadioGroupItemLabelProps = ParentProps<{
  value: string;
  class?: string;
}>;

function RadioGroupItemLabel(props: RadioGroupItemLabelProps) {
  const api = useRadioGroup();

  return (
    <span
      {...api().getItemTextProps({ value: props.value })}
      class={cn(
        "text-sm font-normal data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupLabel, RadioGroupItemLabel, useRadioGroup };
