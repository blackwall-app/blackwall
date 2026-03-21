import { AuthCard } from "@/components/blocks/auth";
import { toast } from "@/components/custom-ui/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { authClient } from "@/lib/auth-client";
import { localizeErrorCode } from "@/lib/error-localization";
import { m } from "@/paraglide/messages.js";
import { A, useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { createSignal } from "solid-js";
import * as z from "zod";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [done, setDone] = createSignal(false);

  const form = useAppForm(() => ({
    defaultValues: {
      newPassword: "",
    },
    validators: {
      onSubmit: z.object({
        newPassword: z.string().min(8),
      }),
    },
    onSubmit: async ({ value }) => {
      const token = searchParams.token as string | undefined;

      const result = await authClient.resetPassword({
        newPassword: value.newPassword,
        token,
      });

      if (result.error) {
        toast.error(localizeErrorCode(result.error.code, result.error.message));
        return;
      }

      setDone(true);
    },
  }));

  const token = searchParams.token as string | undefined;

  if (!token) {
    return (
      <>
        <Title>{m.meta_title_reset_password()}</Title>
        <Meta name="description" content={m.meta_desc_reset_password()} />
        <AuthCard title={m.auth_reset_password_title()}>
          <div class="flex flex-col gap-4">
            <p class="text-sm text-center text-muted-foreground">
              {m.auth_reset_password_invalid_token()}
            </p>
            <A href="/forgot-password" class={buttonVariants({ variant: "link" })}>
              {m.auth_forgot_password_link()}
            </A>
          </div>
        </AuthCard>
      </>
    );
  }

  return (
    <>
      <Title>{m.meta_title_reset_password()}</Title>
      <Meta name="description" content={m.meta_desc_reset_password()} />
      <AuthCard title={m.auth_reset_password_title()}>
        {done() ? (
          <div class="flex flex-col gap-4">
            <p class="text-sm text-center text-muted-foreground">
              {m.auth_reset_password_success()}
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
              <form.AppField name="newPassword">
                {() => (
                  <TanStackTextField
                    label={m.auth_reset_password_new_label()}
                    type="password"
                    autofocus
                    placeholder={m.auth_reset_password_new_placeholder()}
                    inputClass="p-3 h-auto !text-base"
                    autocomplete="new-password"
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
                      {m.auth_reset_password_submit()}
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
