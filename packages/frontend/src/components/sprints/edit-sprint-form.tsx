import * as z from "zod";
import { useAppForm } from "@/context/form-context";
import { action, redirect, useAction, useNavigate } from "@solidjs/router";
import { api } from "@/lib/api";
import type { InferDbType } from "@blackwall/database/types";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { TanStackTextArea, TanStackTextField } from "@/components/ui/text-field";
import { parseDate } from "@internationalized/date";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/custom-ui/date-picker";
import { Button } from "@/components/ui/button";
import type { UpdateIssueSprint } from "@blackwall/backend/src/features/issue-sprints/issue-sprint.zod";
import { toast } from "../custom-ui/toast";
import { m } from "@/paraglide/messages.js";

type EditSprintFormProps = {
  workspaceSlug: string;
  teamKey: string;
  team: InferDbType<"team">;
  sprint: InferDbType<"issueSprint">;
};

const updateSprintAction = action(
  async (workspaceSlug: string, teamKey: string, sprintId: string, value: UpdateIssueSprint) => {
    await api.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"].$patch({
      param: { teamKey, sprintId },
      json: value,
    });

    toast.success(m.edit_sprint_form_toast_updated());
    throw redirect(`/${workspaceSlug}/team/${teamKey}/sprints/${sprintId}`);
  },
);

export function EditSprintForm(props: EditSprintFormProps) {
  const _action = useAction(updateSprintAction);

  const form = useAppForm(() => ({
    defaultValues: {
      name: props.sprint.name,
      goal: props.sprint.goal,
      startDate: parseDate(props.sprint.startDate.split("T")[0]).toString(),
      endDate: parseDate(props.sprint.endDate.split("T")[0]).toString(),
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
      await _action(props.workspaceSlug, props.teamKey, props.sprint.id, value);
    },
  }));

  return (
    <div class="flex flex-col gap-6 mx-auto max-w-2xl p-4 sm:pt-12 sm:pb-12">
      <div class="flex flex-col gap-3 items-center">
        <TeamAvatar team={props.team} size="md" />
        <h1 class="text-xl sm:text-2xl font-medium text-center">{m.edit_sprint_form_title()}</h1>
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
                {m.common_save_changes()}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
