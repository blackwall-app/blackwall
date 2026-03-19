import * as Solid from "solid-js";
import CalendarIcon from "lucide-solid/icons/calendar";
import type { DateValue } from "@zag-js/date-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { DateFormatter, getLocalTimeZone } from "@internationalized/date";
import ChevronDownIcon from "lucide-solid/icons/chevron-down";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime";

type DatePickerProps = {
  selected?: DateValue;
  onSelect?: (dateValue: DateValue) => void;
  id?: string;
  name?: string;
};

export function DatePicker(props: DatePickerProps) {
  const [state, setState] = Solid.createSignal<DateValue | undefined>(props.selected);

  const dateFormatter = Solid.createMemo(
    () => new DateFormatter(getLocale(), { dateStyle: "long" }),
  );

  const formattedDate = () => {
    const nativeDate = state()?.toDate(getLocalTimeZone());
    return nativeDate ? dateFormatter().format(nativeDate) : undefined;
  };

  function handleSelect(dateValue: DateValue) {
    setState(dateValue);
    props.onSelect?.(dateValue);
  }

  Solid.createEffect(() => {
    if (props.selected) {
      setState(props.selected);
    }
  });

  return (
    <Popover>
      <PopoverTrigger
        as={Button}
        variant="outline"
        data-empty={!state()}
        class="data-[empty=true]:text-muted-foreground justify-start text-left font-normal"
        scaleEffect={false}
        id={props.id}
        name={props.name}
      >
        <CalendarIcon />
        <Solid.Show when={formattedDate()} fallback={<span>{m.common_pick_a_date()}</span>}>
          {formattedDate()}
        </Solid.Show>
        <ChevronDownIcon class="size-5 ml-auto" />
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0 border-none shadow-none">
        <Calendar selected={state()} onSelect={handleSelect} name={props.name} />
      </PopoverContent>
    </Popover>
  );
}
