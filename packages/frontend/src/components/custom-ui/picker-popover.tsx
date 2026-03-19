import { usePopoverContext, type PopoverContentProps } from "@kobalte/core/popover";
import { splitProps } from "solid-js";
import { Picker, type PickerOption, type PickerProps } from "./picker";
import { PopoverContent } from "../ui/popover";

export const PickerPopover = <
  TId extends string | number | null,
  TOption extends PickerOption<TId>,
>(
  props: PickerProps<TId, TOption> & PopoverContentProps,
) => {
  const [pickerProps, popoverProps] = splitProps(props, [
    "id",
    "options",
    "value",
    "onChange",
    "multiple",
    "manualFiltering",
    "loading",
    "closeOnSelect",
    "emptyText",
    "search",
    "isOpen",
    "createNew",
    "createNewLabel",
    "onCreateNew",
    "onSearchChange",
    "onClose",
    "renderOption",
  ]);

  const pickerPropsTyped = pickerProps as PickerProps<TId, TOption>;
  const popoverCtx = usePopoverContext();

  return (
    <PopoverContent class="z-50 bg-card min-w-48 p-0 max-w-[16rem]" {...popoverProps}>
      <Picker
        {...pickerPropsTyped}
        isOpen={popoverCtx.isOpen()}
        onClose={() => {
          popoverCtx.close();
          pickerPropsTyped.onClose?.();
        }}
        boxClass="max-h-[300px]"
      />
    </PopoverContent>
  );
};
