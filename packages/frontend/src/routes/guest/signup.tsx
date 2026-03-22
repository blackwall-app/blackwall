import { AuthCard } from "@/components/blocks/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { api } from "@/lib/api";
import { validateFields } from "@/lib/form.utils";
import { slugify } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { A, action, redirect, useAction } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { createSignal, Match, Switch } from "solid-js";
import * as z from "zod";

type SignupFormData = {
  name: string;
  email: string;
  password: string;
  workspaceDisplayName: string;
  workspaceUrlSlug: string;
};

type SignUpFormApi = ReturnType<typeof useSignupForm>;

const signupAction = action(async (value: SignupFormData) => {
  const res = await api.api.auth.signup.email.$post({
    json: value,
  });

  const json = await res.json();
  throw redirect(`/${json.workspace.slug}`);
});

const useSignupForm = () => {
  const _action = useAction(signupAction);
  const form = useAppForm(() => ({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      workspaceDisplayName: "",
      workspaceUrlSlug: "",
    },
    onSubmit: async ({ value, formApi }) => {
      await _action(value);
      formApi.reset();
    },
    listeners: {
      onChange: ({ fieldApi, formApi }) => {
        if (fieldApi.name !== "workspaceDisplayName") {
          return;
        }

        const slug = slugify(fieldApi.state.value);

        formApi.setFieldValue("workspaceUrlSlug", slug);
      },
    },
  }));

  return form;
};

export default function SignupPage() {
  const [step, setStep] = createSignal<"account" | "workspace">("account");
  const form = useSignupForm();

  return (
    <>
      <Title>{m.meta_title_signup()}</Title>
      <Meta name="description" content={m.meta_desc_signup()} />
      <AuthCard title={m.auth_signup_title()}>
        <Switch>
          <Match when={step() === "account"}>
            <AccountForm
              form={form}
              onContinue={() => {
                setStep("workspace");
              }}
            />
          </Match>
          <Match when={step() === "workspace"}>
            <WorkspaceForm
              form={form}
              onBack={() => setStep("account")}
              onContinue={() => {
                form.handleSubmit();
              }}
            />
          </Match>
        </Switch>
      </AuthCard>
    </>
  );
}

function AccountForm(props: { form: SignUpFormApi; onContinue: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();

        const errors = validateFields(props.form, ["email", "password", "name"]);

        if (errors.length === 0) {
          props.onContinue();
        }
      }}
    >
      <div class="flex flex-col gap-6">
        <props.form.AppField
          name="email"
          validators={{
            onBlur: z.email(m.auth_validation_email_invalid()),
          }}
        >
          {() => (
            <TanStackTextField
              label={m.auth_email_address_label()}
              inputClass="p-3 h-auto !text-base"
              type="email"
              placeholder={m.auth_email_placeholder_signup()}
              autofocus
              autocomplete="email"
            />
          )}
        </props.form.AppField>

        <props.form.AppField
          name="password"
          validators={{
            onBlur: z.string().min(8, m.auth_validation_password_min()),
          }}
        >
          {() => (
            <TanStackTextField
              label={m.auth_password_label()}
              inputClass="p-3 h-auto !text-base"
              type="password"
              placeholder={m.auth_password_placeholder_signup()}
              autocomplete="new-password"
            />
          )}
        </props.form.AppField>

        <props.form.AppField
          name="name"
          validators={{
            onBlur: z
              .string()
              .min(2, m.auth_validation_name_min())
              .max(100, m.auth_validation_name_max()),
          }}
        >
          {() => (
            <TanStackTextField
              label={m.auth_full_name_label()}
              inputClass="p-3 h-auto !text-base"
              type="text"
              placeholder={m.auth_full_name_placeholder()}
              autocomplete="name"
            />
          )}
        </props.form.AppField>

        <div class="flex flex-col gap-2">
          <props.form.Subscribe>
            {(state) => (
              <Button
                type="submit"
                size="lg"
                class="text-base"
                disabled={!state().canSubmit || state().isSubmitting}
              >
                {m.auth_continue()}
              </Button>
            )}
          </props.form.Subscribe>

          <A href="/signin" class={buttonVariants({ variant: "link" })}>
            {m.auth_back_to_login()}
          </A>
        </div>
      </div>
    </form>
  );
}

function WorkspaceForm(props: { form: SignUpFormApi; onBack: () => void; onContinue: () => void }) {
  // oxlint-disable-next-line no-unassigned-vars
  let urlSpan!: HTMLSpanElement;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onContinue();
      }}
    >
      <div class="flex flex-col gap-6">
        <props.form.AppField
          name="workspaceDisplayName"
          validators={{
            onBlur: z
              .string()
              .min(3, m.auth_validation_workspace_name_min())
              .max(64, m.auth_validation_workspace_name_max()),
          }}
        >
          {() => (
            <TanStackTextField
              label={m.auth_workspace_name_label()}
              inputClass="p-3 h-auto !text-base"
              type="text"
              placeholder={m.auth_workspace_name_placeholder()}
              autofocus
            />
          )}
        </props.form.AppField>

        <props.form.AppField
          name="workspaceUrlSlug"
          validators={{
            onBlur: z
              .string()
              .min(3, m.auth_validation_workspace_url_min())
              .max(64, m.auth_validation_workspace_url_max()),
          }}
        >
          {() => (
            <TanStackTextField
              label={m.auth_workspace_url_label()}
              inputClass="p-3 h-auto !text-base"
              type="text"
              placeholder={m.auth_workspace_url_placeholder()}
              inputStyle={{
                "padding-left": `${urlSpan.offsetWidth + 11}px`,
              }}
              beforeInput={
                <span
                  ref={urlSpan}
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                >
                  {window.location.origin}/
                </span>
              }
            />
          )}
        </props.form.AppField>

        <div class="flex flex-col gap-2">
          <Button type="submit" size="lg" class="text-base">
            {m.auth_continue()}
          </Button>

          <Button type="button" variant="link" onClick={() => props.onBack()}>
            {m.auth_back_to_account_details()}
          </Button>
        </div>
      </div>
    </form>
  );
}
