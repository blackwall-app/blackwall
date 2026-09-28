import { AUTH_EMAIL_PATTERN } from "@blackwall/shared";
import { Predicate, Schema } from "effect";
import { m } from "@/paraglide/messages.js";

// Form validators for TanStack Form, which takes Standard Schema. They are
// functions so messages localize when the form is created.

const minLength = (length: number, message: string) => Schema.isMinLength(length, { message });

const maxLength = (length: number, message: string) => Schema.isMaxLength(length, { message });

const email = (message: string) =>
  Schema.String.check(Schema.isPattern(AUTH_EMAIL_PATTERN, { message }));

const password = (message: string) => Schema.String.check(minLength(8, message));

const isoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { expected: "a date in YYYY-MM-DD format" }),
);

const endDateNotBeforeStart = () =>
  Schema.makeFilter((value: { readonly startDate: string; readonly endDate: string }) =>
    value.endDate >= value.startDate
      ? undefined
      : { path: ["endDate"], issue: m.common_end_date_on_or_after_start_date() },
  );

const form = Schema.toStandardSchemaV1;

export const signinFormSchema = () =>
  form(
    Schema.Struct({
      email: email(m.auth_validation_email_invalid()),
      password: password(m.auth_validation_password_min()),
    }),
  );

export const signupEmailFieldSchema = () => form(email(m.auth_validation_email_invalid()));

export const signupPasswordFieldSchema = () => form(password(m.auth_validation_password_min()));

const lengthBetween = (min: number, minMessage: string, max: number, maxMessage: string) =>
  form(Schema.String.check(minLength(min, minMessage), maxLength(max, maxMessage)));

export const signupNameFieldSchema = () =>
  lengthBetween(2, m.auth_validation_name_min(), 100, m.auth_validation_name_max());

export const signupWorkspaceNameFieldSchema = () =>
  lengthBetween(
    3,
    m.auth_validation_workspace_name_min(),
    64,
    m.auth_validation_workspace_name_max(),
  );

export const signupWorkspaceUrlFieldSchema = () =>
  lengthBetween(
    3,
    m.auth_validation_workspace_url_min(),
    64,
    m.auth_validation_workspace_url_max(),
  );

export const forgotPasswordFormSchema = () =>
  form(Schema.Struct({ email: email(m.auth_validation_email_invalid()) }));

export const resetPasswordFormSchema = () =>
  form(Schema.Struct({ newPassword: password(m.auth_validation_password_min()) }));

export const acceptInviteFormSchema = () =>
  form(
    Schema.Struct({
      name: Schema.String.check(minLength(2, m.either_invite_name_required())),
      password: password(m.either_invite_password_min()),
    }),
  );

export const inviteFormSchema = () =>
  form(
    Schema.Struct({
      email: Schema.String.check(
        Schema.makeFilter((value: string) =>
          value.length === 0
            ? m.invite_dialog_email_required()
            : AUTH_EMAIL_PATTERN.test(value) || m.auth_validation_email_invalid(),
        ),
      ),
    }),
  );

export const workspaceNameFormSchema = () =>
  form(
    Schema.Struct({
      name: Schema.String.check(
        minLength(1, m.settings_workspace_name_required()),
        maxLength(100, m.settings_workspace_name_too_long()),
      ),
    }),
  );

export const displayNameFormSchema = () =>
  form(
    Schema.Struct({
      name: Schema.String.check(
        minLength(2, m.settings_profile_name_min()),
        maxLength(100, m.settings_profile_name_max()),
      ),
    }),
  );

export const changePasswordFormSchema = () =>
  form(
    Schema.Struct({
      currentPassword: password(m.settings_profile_password_validation_current()),
      newPassword: password(m.settings_profile_password_validation_new()),
      confirmPassword: password(m.settings_profile_password_validation_confirm()),
    }).check(
      Schema.makeFilter((value) =>
        value.newPassword === value.confirmPassword
          ? undefined
          : {
              path: ["confirmPassword"],
              issue: m.settings_profile_password_validation_mismatch(),
            },
      ),
    ),
  );

const teamName = () => Schema.String.check(minLength(1, m.common_name_required()));

const teamKey = () =>
  Schema.String.check(
    minLength(1, m.settings_teams_key_required()),
    maxLength(5, m.settings_teams_key_max()),
  );

export const createTeamFormSchema = () => form(Schema.Struct({ name: teamName(), key: teamKey() }));

export const teamNameFormSchema = () => form(Schema.Struct({ name: teamName() }));

export const teamKeyFormSchema = () => form(Schema.Struct({ key: teamKey() }));

export const createIssueFormSchema = () =>
  form(
    Schema.Struct({
      teamKey: Schema.String.check(minLength(1, m.create_dialog_team_key_required())),
      summary: Schema.String.check(minLength(1, m.create_dialog_summary_required())),
      status: Schema.Literals(["to_do", "in_progress", "done"]).annotate({
        message: m.create_dialog_status_required(),
      }),
      description: Schema.Any.check(
        Schema.makeFilter(Predicate.isNotNullish, {
          message: m.create_dialog_description_required(),
        }),
      ),
      assignedToId: Schema.NullOr(Schema.String),
      sprintId: Schema.NullOr(Schema.String),
    }),
  );

export const sprintFormSchema = () =>
  form(
    Schema.Struct({
      name: Schema.String.check(minLength(1, m.common_name_required())),
      goal: Schema.NullOr(Schema.String),
      startDate: isoDate,
      endDate: isoDate,
    }).check(endDateNotBeforeStart()),
  );

export const completeSprintFormSchema = () =>
  form(
    Schema.Struct({
      onUndoneIssues: Schema.Literals(["moveToBacklog", "moveToPlannedSprint", "moveToNewSprint"]),
      targetSprintId: Schema.NullOr(Schema.String),
      newSprintName: Schema.String,
      newSprintStartDate: isoDate,
      newSprintEndDate: isoDate,
    }).check(
      Schema.makeFilter((value) => {
        const issues: Array<Schema.FilterIssue> = [];
        if (value.onUndoneIssues === "moveToPlannedSprint" && !value.targetSprintId) {
          issues.push({
            path: ["targetSprintId"],
            issue: m.complete_sprint_form_validation_choose_planned(),
          });
        }
        if (value.onUndoneIssues === "moveToNewSprint") {
          if (!value.newSprintName.trim()) {
            issues.push({
              path: ["newSprintName"],
              issue: m.complete_sprint_form_validation_name_required(),
            });
          }
          if (value.newSprintEndDate < value.newSprintStartDate) {
            issues.push({
              path: ["newSprintEndDate"],
              issue: m.common_end_date_on_or_after_start_date(),
            });
          }
        }
        return issues;
      }),
    ),
  );
