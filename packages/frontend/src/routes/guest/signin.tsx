import { AuthCard } from "@/components/blocks/auth";
import { toast } from "@/components/custom-ui/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { authClient } from "@/lib/auth-client";
import { localizeErrorCode } from "@/lib/error-localization";
import { m } from "@/paraglide/messages.js";
import { A, action, redirect, useAction, useSearchParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import * as z from "zod";

const signinAction = action(async (email: string, password: string, back?: string) => {
  const result = await authClient.signIn.email({
    email,
    password,
  });

  if (result.error) {
    toast.error(localizeErrorCode(result.error.code, result.error.message));
    return;
  }

  const safeBack = back && back.startsWith("/") ? back : "/";
  throw redirect(safeBack);
});

export default function SignInPage() {
  const _action = useAction(signinAction);
  const [searchParams] = useSearchParams();

  const form = useAppForm(() => ({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: z.object({
        email: z.email(m.auth_validation_email_invalid()),
        password: z.string().min(8, m.auth_validation_password_min()),
      }),
    },
    onSubmit: async ({ value }) => {
      _action(value.email, value.password, searchParams.back as string | undefined);
    },
  }));

  return (
    <>
      <Title>{m.meta_title_signin()}</Title>
      <Meta name="description" content={m.meta_desc_signin()} />
      <AuthCard title={m.auth_signin_title()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div class="flex flex-col gap-6">
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

            <form.AppField name="password">
              {() => (
                <TanStackTextField
                  label={m.auth_password_label()}
                  labelSuffix={
                    <A
                      href="/forgot-password"
                      class={buttonVariants({ variant: "link", size: "sm" })}
                      style={{ "padding-inline": "0", height: "auto" }}
                    >
                      {m.auth_forgot_password_link()}
                    </A>
                  }
                  type="password"
                  placeholder={m.auth_password_placeholder_signin()}
                  inputClass="p-3 h-auto !text-base"
                />
              )}
            </form.AppField>

            <form.Subscribe>
              {(state) => (
                <div class="flex flex-col gap-2">
                  <Button type="submit" size="lg" class="text-base" disabled={!state().canSubmit}>
                    {m.auth_signin_submit()}
                  </Button>

                  <A href="/signup" class={buttonVariants({ variant: "link" })}>
                    {m.auth_signup_link()}
                  </A>
                </div>
              )}
            </form.Subscribe>
          </div>
        </form>
      </AuthCard>
    </>
  );
}
