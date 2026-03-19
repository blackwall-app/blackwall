import { AuthCard } from "@/components/blocks/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { A } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { createSignal } from "solid-js";
import * as z from "zod";

export default function ForgotPasswordPage() {
  const [sent, setSent] = createSignal(false);

  const form = useAppForm(() => ({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: z.object({
        email: z.email(),
      }),
    },
    onSubmit: async ({ value }) => {
      await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
      });
      setSent(true);
    },
  }));

  return (
    <>
      <Title>{m.meta_title_forgot_password()}</Title>
      <Meta name="description" content={m.meta_desc_forgot_password()} />
      <AuthCard title={m.auth_forgot_password_title()}>
        {sent() ? (
          <div class="flex flex-col gap-4">
            <p class="text-sm text-center text-muted-foreground">
              {m.auth_forgot_password_success()}
            </p>
            <A href="/signin" class={buttonVariants({ variant: "link" })}>
              {m.auth_back_to_login()}
            </A>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div class="flex flex-col gap-6">
              <p class="text-sm text-center text-muted-foreground">
                {m.auth_forgot_password_description()}
              </p>

              <form.AppField name="email">
                {() => (
                  <TanStackTextField
                    label={m.auth_email_address_label()}
                    type="email"
                    autofocus
                    placeholder={m.auth_email_placeholder_signin()}
                    inputClass="p-3 h-auto !text-base"
                  />
                )}
              </form.AppField>

              <form.Subscribe>
                {(state) => (
                  <div class="flex flex-col gap-2">
                    <Button
                      type="submit"
                      size="lg"
                      class="text-base"
                      disabled={!state().canSubmit || state().isSubmitting}
                    >
                      {m.auth_forgot_password_submit()}
                    </Button>

                    <A href="/signin" class={buttonVariants({ variant: "link" })}>
                      {m.auth_back_to_login()}
                    </A>
                  </div>
                )}
              </form.Subscribe>
            </div>
          </form>
        )}
      </AuthCard>
    </>
  );
}
