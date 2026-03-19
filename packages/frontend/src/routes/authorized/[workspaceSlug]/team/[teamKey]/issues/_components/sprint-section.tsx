import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SerializedIssueSprint } from "@blackwall/database/schema";
import { A, useParams } from "@solidjs/router";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import ChevronDownIcon from "lucide-solid/icons/chevron-down";
import { Show } from "solid-js";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime";

export function SprintSection(props: { sprint: SerializedIssueSprint | null }) {
  const params = useParams();

  return (
    <section class="flex flex-row gap-2 items-center">
      <Show when={props.sprint}>
        {(sprint) => (
          <Popover>
            <PopoverTrigger as={Button} variant="ghost" size="xxs" class="gap-1.5 font-semibold">
              <LandPlotIcon class="size-4 shrink-0" />
              {sprint().name}
              <ChevronDownIcon class="size-3.5 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent class="w-72 p-0">
              <div class="font-semibold text-accent-foreground flex flex-row items-center gap-1.5 px-4 py-3 border-b">
                <LandPlotIcon class="size-4 shrink-0" />
                {sprint().name}
              </div>
              <div class="px-4 py-3 flex flex-col gap-3">
                <div class="flex flex-row items-center justify-between">
                  <p class="text-xs text-muted-foreground">{m.common_start_date()}</p>
                  <p class="text-sm font-medium">
                    {new Date(sprint().startDate).toLocaleDateString(getLocale())}
                  </p>
                </div>

                <div class="flex flex-row items-center justify-between">
                  <p class="text-xs text-muted-foreground">{m.common_end_date()}</p>
                  <p class="text-sm font-medium">
                    {new Date(sprint().endDate).toLocaleDateString(getLocale())}
                  </p>
                </div>

                <Show when={sprint().goal}>
                  <div>
                    <p class="text-xs text-muted-foreground mb-1">{m.common_goal()}</p>
                    <p class="text-sm">{sprint().goal}</p>
                  </div>
                </Show>
              </div>
              <div class="px-4 py-3 border-t flex flex-row gap-2">
                <A
                  href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${sprint().id}`}
                  class={buttonVariants({
                    variant: "outline",
                    size: "xs",
                    class: "flex-1",
                  })}
                >
                  {m.common_details()}
                </A>
                <A
                  href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${sprint().id}/edit`}
                  class={buttonVariants({
                    variant: "outline",
                    size: "xs",
                    class: "flex-1",
                  })}
                >
                  {m.common_edit()}
                </A>
                <A
                  href={`/${params.workspaceSlug}/team/${params.teamKey}/sprints/${sprint().id}/complete`}
                  class={buttonVariants({
                    variant: "outline",
                    size: "xs",
                    class: "flex-1",
                  })}
                >
                  {m.common_complete()}
                </A>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </Show>
    </section>
  );
}
