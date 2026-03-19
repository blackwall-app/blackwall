import * as z from "zod";
import { useAppForm } from "@/context/form-context";
import { action, redirect, useAction } from "@solidjs/router";
import { api } from "@/lib/api";
import type { InferDbType } from "@blackwall/database/types";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { TanStackTextArea, TanStackTextField } from "@/components/ui/text-field";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/custom-ui/date-picker";
import { Button } from "@/components/ui/button";
import { toast } from "../custom-ui/toast";
import { m } from "@/paraglide/messages.js";

type SprintFormProps = {
  workspaceSlug: string;
  teamKey: string;
  team: InferDbType<"team">;
  title: string;
  buttonText: string;
};

const createSprintAction = action(
  async (
    workspaceSlug: string,
    teamKey: string,
    value: {
      name: string;
      goal: string | null;
      startDate: string;
      endDate: string;
    },
  ) => {
    await api.api["issue-sprints"].teams[":teamKey"].sprints.$post({
      param: { teamKey },
      json: {
        name: value.name,
        goal: value.goal,
        startDate: value.startDate,
        endDate: value.endDate,
      },
    });

    toast.success(m.sprint_form_toast_created());

    throw redirect(`/${workspaceSlug}/team/${teamKey}/issues/board`);
  },
);

export function SprintForm(props: SprintFormProps) {
  const _action = useAction(createSprintAction);

  const form = useAppForm(() => ({
    defaultValues: {
      name: "",
      goal: null as string | null,
      startDate: today(getLocalTimeZone()).toString(),
      endDate: today(getLocalTimeZone()).add({ weeks: 2 }).toString(),
    },
    validators: {
      onSubmit: z
        .object({
          name: z.string().min(1, m.common_name_required()),
          goal: z.string().nullable(),
          startDate: z.iso.date(),
          endDate: z.iso.date(),
        })
        .refine((data) => data.endDate >= data.startDate, {
          message: m.common_end_date_on_or_after_start_date(),
          path: ["endDate"],
        }),
    },
    onSubmit: async ({ value }) => {
      await _action(props.workspaceSlug, props.teamKey, value);
    },
  }));

  return (
    <div class="flex flex-col gap-6 mx-auto max-w-2xl p-4 sm:pt-12 sm:pb-12">
      <div class="flex flex-col gap-3 items-center">
        <TeamAvatar team={props.team} size="md" />
        <h1 class="text-xl sm:text-2xl font-medium text-center">{props.title}</h1>
      </div>

      <form
        class="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.AppField name="name">
          {() => (
            <TanStackTextField
              label={m.common_name_label()}
              placeholder={m.sprint_form_name_placeholder()}
            />
          )}
        </form.AppField>

        <form.AppField name="goal">
          {() => (
            <TanStackTextArea
              label={m.common_goal()}
              placeholder={m.sprint_form_goal_placeholder()}
              textareaClass="min-h-24"
            />
          )}
        </form.AppField>

        <div class="flex flex-col gap-2 sm:flex-row">
          <form.AppField name="startDate">
            {(field) => {
              const calendarDate = () => parseDate(field().state.value);

              return (
                <div class="flex flex-col gap-2 w-full">
                  <Label for={field().name}>{m.common_start_date()}</Label>
                  <DatePicker
                    selected={calendarDate()}
                    onSelect={(date) => field().handleChange(date.toString())}
                  />
                </div>
              );
            }}
          </form.AppField>

          <form.AppField name="endDate">
            {(field) => {
              const calendarDate = () => parseDate(field().state.value);

              return (
                <div class="flex flex-col gap-2 w-full">
                  <Label for={field().name}>{m.common_end_date()}</Label>
                  <DatePicker
                    selected={calendarDate()}
                    onSelect={(date) => field().handleChange(date.toString())}
                  />
                </div>
              );
            }}
          </form.AppField>
        </div>

        <form.Subscribe>
          {(state) => (
            <div class="flex flex-col gap-2 items-center mt-2">
              <Button type="submit" size="lg" disabled={!state().canSubmit}>
                {props.buttonText}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
