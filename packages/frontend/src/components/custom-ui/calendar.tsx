import * as datepicker from "@zag-js/date-picker";
import { useMachine, normalizeProps } from "@zag-js/solid";
import { createMemo, createUniqueId, Index } from "solid-js";
import { cn } from "@/lib/utils";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import { getLocale } from "@/paraglide/runtime";

type CalendarProps = {
  selected?: datepicker.DateValue;
  onSelect?: (date: datepicker.DateValue) => void;
  name?: string;
};

/**
 * Zag.js Calendar component styled like shadcn/ui
 */
export function Calendar(props: CalendarProps) {
  const service = useMachine(datepicker.machine, () => ({
    id: createUniqueId(),
    defaultOpen: true,
    name: props.name,
    open: true,
    inline: true,
    locale: getLocale(),
    value: props.selected ? [props.selected] : undefined,
    onValueChange: (value) => value.value.length > 0 && props.onSelect?.(value.value[0]),
  }));

  const api = createMemo(() => datepicker.connect(service, normalizeProps));

  const navButtonClass =
    "inline-flex items-center justify-center size-8 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

  const cellTriggerClass = cn(
    "inline-flex items-center justify-center size-8 rounded-md text-sm font-normal transition-colors cursor-default",
    "hover:bg-accent hover:text-accent-foreground",
    "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground",
    "data-[today]:bg-accent data-[today]:text-accent-foreground data-[today]:data-[selected]:bg-primary data-[today]:data-[selected]:text-primary-foreground",
    "data-[outside-range]:text-muted-foreground data-[outside-range]:opacity-50",
    "data-[disabled]:text-muted-foreground data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
    "data-[unavailable]:text-muted-foreground data-[unavailable]:line-through data-[unavailable]:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  return (
    <div
      {...api().getContentProps()}
      class="bg-background p-3 rounded-md border shadow-sm [--cell-size:2rem]"
    >
      <div hidden={api().view !== "day"}>
        <div {...api().getViewControlProps()} class="flex items-center justify-between mb-4">
          <button {...api().getPrevTriggerProps()} class={navButtonClass}>
            <ChevronLeft class="size-4" />
          </button>
          <button
            {...api().getViewTriggerProps()}
            class="text-sm font-medium hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded-md transition-colors"
          >
            {api().visibleRangeText.start}
          </button>
          <button {...api().getNextTriggerProps()} class={navButtonClass}>
            <ChevronRight class="size-4" />
          </button>
        </div>

        <table {...api().getTableProps()} class="w-full border-collapse">
          <thead {...api().getTableHeaderProps()}>
            <tr {...api().getTableBodyProps()} class="flex">
              <Index each={api().weekDays}>
                {(day) => (
                  <th
                    scope="col"
                    aria-label={day().long}
                    class="text-muted-foreground text-[0.8rem] font-normal flex-1 text-center select-none"
                  >
                    {day().narrow}
                  </th>
                )}
              </Index>
            </tr>
          </thead>
          <tbody {...api().getTableBodyProps()}>
            <Index each={api().weeks}>
              {(week) => (
                <tr {...api().getTableRowProps()} class="flex mt-2">
                  <Index each={week()}>
                    {(value) => (
                      <td
                        {...api().getDayTableCellProps({ value: value() })}
                        class="relative flex-1 text-center p-0 select-none"
                      >
                        <div
                          {...api().getDayTableCellTriggerProps({
                            value: value(),
                          })}
                          class={cellTriggerClass}
                        >
                          {value().day}
                        </div>
                      </td>
                    )}
                  </Index>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>

      <div hidden={api().view !== "month"}>
        <div
          {...api().getViewControlProps({ view: "month" })}
          class="flex items-center justify-between mb-4"
        >
          <button {...api().getPrevTriggerProps({ view: "month" })} class={navButtonClass}>
            <ChevronLeft class="size-4" />
          </button>
          <button
            {...api().getViewTriggerProps({ view: "month" })}
            class="text-sm font-medium hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded-md transition-colors"
          >
            {api().visibleRange.start.year}
          </button>
          <button {...api().getNextTriggerProps({ view: "month" })} class={navButtonClass}>
            <ChevronRight class="size-4" />
          </button>
        </div>

        <table {...api().getTableProps({ view: "month", columns: 4 })} class="w-full">
          <tbody>
            <Index each={api().getMonthsGrid({ columns: 4, format: "short" })}>
              {(months) => (
                <tr {...api().getTableBodyProps({ view: "month" })}>
                  <Index each={months()}>
                    {(month) => (
                      <td {...api().getMonthTableCellProps(month())} class="p-0.5">
                        <div
                          {...api().getMonthTableCellTriggerProps(month())}
                          class={cn(cellTriggerClass, "w-full h-9 rounded-md text-sm")}
                        >
                          {month().label}
                        </div>
                      </td>
                    )}
                  </Index>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>

      <div hidden={api().view !== "year"}>
        <div
          {...api().getViewControlProps({ view: "year" })}
          class="flex items-center justify-between mb-4"
        >
          <button {...api().getPrevTriggerProps({ view: "year" })} class={navButtonClass}>
            <ChevronLeft class="size-4" />
          </button>
          <span class="text-sm font-medium">
            {api().getDecade().start} - {api().getDecade().end}
          </span>
          <button {...api().getNextTriggerProps({ view: "year" })} class={navButtonClass}>
            <ChevronRight class="size-4" />
          </button>
        </div>

        <table {...api().getTableProps({ view: "year", columns: 4 })} class="w-full">
          <tbody>
            <Index each={api().getYearsGrid({ columns: 4 })}>
              {(years) => (
                <tr {...api().getTableBodyProps({ view: "year" })}>
                  <Index each={years()}>
                    {(year) => (
                      <td
                        {...api().getYearTableCellProps({
                          ...year(),
                          columns: 4,
                        })}
                        class="p-0.5"
                      >
                        <div
                          {...api().getYearTableCellTriggerProps({
                            ...year(),
                            columns: 4,
                          })}
                          class={cn(cellTriggerClass, "w-full h-9 rounded-md text-sm")}
                        >
                          {year().label}
                        </div>
                      </td>
                    )}
                  </Index>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>
    </div>
  );
}
