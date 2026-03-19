import * as z from "zod";
import { useAppForm } from "@/context/form-context";
import { action, redirect, useAction } from "@solidjs/router";
import { api } from "@/lib/api";
import type { InferDbType } from "@blackwall/database/types";
import type { SerializedIssueSprint } from "@blackwall/database/schema";
import { TeamAvatar } from "@/components/custom-ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "../custom-ui/toast";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/custom-ui/date-picker";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { TanStackTextField } from "@/components/ui/text-field";
import { Popover } from "@kobalte/core/popover";
import { PickerPopover } from "@/components/custom-ui/picker-popover";
import LandPlotIcon from "lucide-solid/icons/land-plot";
import ChevronsUpDownIcon from "lucide-solid/icons/chevrons-up-down";
import type { CompleteIssueSprint } from "@blackwall/backend/src/features/issue-sprints/issue-sprint.zod";
import { Show } from "solid-js";
import { m } from "@/paraglide/messages.js";

type CompleteSprintFormProps = {
  workspaceSlug: string;
  teamKey: string;
  team: InferDbType<"team">;
  sprint: InferDbType<"issueSprint">;
  plannedSprints: SerializedIssueSprint[];
  hasUndoneIssues: boolean;
};

const completeSprintAction = action(
  async (workspaceSlug: string, teamKey: string, sprintId: string, value: CompleteIssueSprint) => {
    await api.api["issue-sprints"].teams[":teamKey"].sprints[":sprintId"].complete.$post({
      param: { teamKey, sprintId },
      json: value,
    });

    toast.success(m.complete_sprint_form_toast_completed());
    throw redirect(`/${workspaceSlug}/team/${teamKey}/sprints`);
  },
);

const formSchema = z
  .object({
    onUndoneIssues: z.enum(["moveToBacklog", "moveToPlannedSprint", "moveToNewSprint"]),
    targetSprintId: z.string().nullable(),
    newSprintName: z.string(),
    newSprintStartDate: z.iso.date(),
    newSprintEndDate: z.iso.date(),
  })
  .superRefine((value, ctx) => {
    if (value.onUndoneIssues === "moveToPlannedSprint" && !value.targetSprintId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSprintId"],
        message: m.complete_sprint_form_validation_choose_planned(),
      });
    }

    if (value.onUndoneIssues === "moveToNewSprint") {
      if (!value.newSprintName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newSprintName"],
          message: m.complete_sprint_form_validation_name_required(),
        });
      }

      if (value.newSprintEndDate < value.newSprintStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newSprintEndDate"],
          message: m.common_end_date_on_or_after_start_date(),
        });
      }
    }
  });

export function CompleteSprintForm(props: CompleteSprintFormProps) {
  const _action = useAction(completeSprintAction);

  const plannedSprintOptions = () =>
    props.plannedSprints.map((sprint) => ({
      id: sprint.id,
      label: sprint.name,
      icon: () => <LandPlotIcon class="size-4" />,
    }));

  const form = useAppForm(() => ({
    defaultValues: {
      onUndoneIssues: "moveToBacklog" as
        | "moveToBacklog"
        | "moveToPlannedSprint"
        | "moveToNewSprint",
      targetSprintId: null as string | null,
      newSprintName: "",
      newSprintStartDate: today(getLocalTimeZone()).toString(),
      newSprintEndDate: today(getLocalTimeZone()).add({ weeks: 2 }).toString(),
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      let payload: CompleteIssueSprint;

      if (!props.hasUndoneIssues || value.onUndoneIssues === "moveToBacklog") {
        payload = { onUndoneIssues: "moveToBacklog" };
      } else if (value.onUndoneIssues === "moveToPlannedSprint") {
        payload = {
          onUndoneIssues: "moveToPlannedSprint",
          targetSprintId: value.targetSprintId!,
        };
      } else {
        payload = {
          onUndoneIssues: "moveToNewSprint",
          newSprint: {
            name: value.newSprintName,
            startDate: value.newSprintStartDate,
            endDate: value.newSprintEndDate,
          },
        };
      }

      await _action(props.workspaceSlug, props.teamKey, props.sprint.id, payload);
    },
  }));

  return (
    <div class="flex flex-col gap-6 mx-auto max-w-2xl p-4 sm:pt-12 sm:pb-12">
      <div class="flex flex-col gap-3 items-center">
        <TeamAvatar team={props.team} size="md" />
        <h1 class="text-xl sm:text-2xl font-medium text-center">
          {m.complete_sprint_form_title({ teamName: props.team.name })}
        </h1>
      </div>

      <div class="flex flex-col gap-4 text-center">
        <p class="text-muted-foreground">
          {m.complete_sprint_form_intro_line_one({ sprintName: props.sprint.name })}
        </p>
        <p class="text-muted-foreground text-sm">
          {props.hasUndoneIssues
            ? m.complete_sprint_form_intro_with_undone()
            : m.complete_sprint_form_intro_all_done()}
        </p>
      </div>

      <form
        class="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <Show when={props.hasUndoneIssues}>
          <form.AppField name="onUndoneIssues">
            {(field) => (
              <FieldSet>
                <FieldLegend variant="label">
                  {m.complete_sprint_form_on_undone_legend()}
                </FieldLegend>
                <RadioGroup
                  value={field().state.value}
                  onValueChange={(value) => field().handleChange(value)}
                >
                  <FieldLabel for="completeMoveToBacklog">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {m.complete_sprint_form_option_move_backlog_title()}
                        </FieldTitle>
                        <FieldDescription>
                          {m.complete_sprint_form_option_move_backlog_description()}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        value="moveToBacklog"
                        id="completeMoveToBacklog"
                        aria-label={m.complete_sprint_form_option_move_backlog_title()}
                      />
                    </Field>
                  </FieldLabel>

                  <FieldLabel for="completeMoveToPlannedSprint">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>
                          {m.complete_sprint_form_option_move_planned_title()}
                        </FieldTitle>
                        <FieldDescription>
                          {m.complete_sprint_form_option_move_planned_description()}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        value="moveToPlannedSprint"
                        id="completeMoveToPlannedSprint"
                        aria-label={m.complete_sprint_form_option_move_planned_title()}
                      />
                    </Field>
                  </FieldLabel>

                  <FieldLabel for="completeMoveToNewSprint">
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{m.complete_sprint_form_option_move_new_title()}</FieldTitle>
                        <FieldDescription>
                          {m.complete_sprint_form_option_move_new_description()}
                        </FieldDescription>
                      </FieldContent>
                      <RadioGroupItem
                        value="moveToNewSprint"
                        id="completeMoveToNewSprint"
                        aria-label={m.complete_sprint_form_option_move_new_title()}
                      />
                    </Field>
                  </FieldLabel>
                </RadioGroup>
              </FieldSet>
            )}
          </form.AppField>
        </Show>

        <form.Subscribe>
          {(state) => (
            <>
              {props.hasUndoneIssues && state().values.onUndoneIssues === "moveToPlannedSprint" && (
                <form.AppField name="targetSprintId">
                  {(field) => (
                    <div class="flex flex-col gap-2">
                      <Label for="targetSprintId">
                        {m.complete_sprint_form_planned_sprint_label()}
                      </Label>
                      <Popover placement="bottom-start" gutter={8}>
                        <Popover.Trigger
                          as={Button}
                          variant="outline"
                          size="lg"
                          scaleEffect={false}
                        >
                          <LandPlotIcon class="size-4" />
                          {props.plannedSprints.find((s) => s.id === field().state.value)?.name ??
                            m.complete_sprint_form_select_planned_sprint()}
                          <ChevronsUpDownIcon class="size-4" />
                        </Popover.Trigger>
                        <PickerPopover
                          value={field().state.value}
                          onChange={(value) => field().handleChange(value as string)}
                          options={plannedSprintOptions()}
                        />
                      </Popover>
                    </div>
                  )}
                </form.AppField>
              )}

              {props.hasUndoneIssues && state().values.onUndoneIssues === "moveToNewSprint" && (
                <>
                  <form.AppField name="newSprintName">
                    {() => (
                      <TanStackTextField
                        label={m.complete_sprint_form_new_sprint_name_label()}
                        placeholder={m.complete_sprint_form_new_sprint_name_placeholder()}
                      />
                    )}
                  </form.AppField>

                  <div class="flex flex-col gap-2 sm:flex-row">
                    <form.AppField name="newSprintStartDate">
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

                    <form.AppField name="newSprintEndDate">
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
                </>
              )}
            </>
          )}
        </form.Subscribe>

        <form.Subscribe>
          {(state) => (
            <div class="flex flex-col gap-2 items-center mt-2">
              <Button type="submit" size="lg" disabled={!state().canSubmit}>
                {m.team_sprints_detail_complete_sprint()}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
