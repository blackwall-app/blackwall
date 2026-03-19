import { AuthCard } from "@/components/blocks/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { useMaybeSessionData } from "@/context/maybe-session.context";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { A, createAsync, useNavigate, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { Show } from "solid-js";
import * as z from "zod";
import { invitationLoader } from "./[token].data";

export default function InvitePage() {
  const params = useParams();
  const navigate = useNavigate();
  const session = useMaybeSessionData();
  const invitation = createAsync(() => invitationLoader(params.token!));

  const form = useAppForm(() => ({
    defaultValues: {
      name: "",
      password: "",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, m.either_invite_name_required()),
        password: z.string().min(8, m.either_invite_password_min()),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const res = await api.api.invitations[":token"].register.$post({
        param: { token: params.token! },
        json: value,
      });

      if (!res.ok) {
        const error = await res.json();
        formApi.setErrorMap({
          // @ts-expect-error TODO - change to some result type or error wrapper that handles this
          onSubmit: error.error || m.either_invite_join_failed(),
        });
        return;
      }

      const data = await res.json();
      navigate(`/${data.workspaceSlug}`);
    },
  }));

  const handleJoin = async () => {
    const res = await api.api.invitations[":token"].accept.$post({
      param: { token: params.token! },
    });

    if (res.ok) {
      const data = await res.json();
      navigate(`/${data.workspaceSlug}`);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.reload();
  };

  return (
    <div>
      <Title>{m.meta_title_join_workspace()}</Title>
      <Meta name="description" content={m.meta_desc_join_workspace()} />

      {/* State 2: authenticated, wrong email — checked first */}
      <Show
        when={
          session() !== null &&
          invitation() &&
          session()!.user.email.toLowerCase() !== invitation()!.email.toLowerCase()
        }
      >
        <AuthCard title={m.either_invite_wrong_email_title()}>
          <div class="flex flex-col gap-4">
            <p class="text-sm text-muted-foreground">
              {m.either_invite_wrong_email_desc({ email: invitation()!.email })}
            </p>
            <Button variant="outline" size="lg" class="text-base" onClick={handleSignOut}>
              {m.either_invite_signout_to_switch()}
            </Button>
          </div>
        </AuthCard>
      </Show>

      {/* State 3: authenticated, email matches, already a member */}
      <Show
        when={
          session() !== null &&
          invitation() &&
          session()!.user.email.toLowerCase() === invitation()!.email.toLowerCase() &&
          invitation()!.isMember
        }
      >
        <AuthCard title={m.either_invite_already_member_title()}>
          <div class="flex flex-col gap-4">
            <p class="text-sm text-muted-foreground">
              {m.either_invite_already_member_desc({
                workspaceName: invitation()!.workspace.displayName,
              })}
            </p>
            <A
              href={`/${invitation()!.workspace.slug}`}
              class={buttonVariants({ size: "lg", class: "text-base" })}
            >
              {m.either_invite_go_to_workspace()}
            </A>
            <Button variant="outline" size="lg" class="text-base" onClick={handleSignOut}>
              {m.either_invite_signout_to_switch()}
            </Button>
          </div>
        </AuthCard>
      </Show>

      {/* State 4: authenticated, email matches, not yet a member */}
      <Show
        when={
          session() !== null &&
          invitation() &&
          session()!.user.email.toLowerCase() === invitation()!.email.toLowerCase() &&
          !invitation()!.isMember
        }
      >
        <AuthCard
          title={m.either_invite_join_title({ workspaceName: invitation()!.workspace.displayName })}
        >
          <div class="flex flex-col gap-4">
            <Button size="lg" class="text-base" onClick={handleJoin}>
              {m.either_invite_join_as({ name: session()!.user.name })}
            </Button>
          </div>
        </AuthCard>
      </Show>

      {/* State 1: unauthenticated */}
      <Show when={session() === null}>
        <AuthCard
          title={m.either_invite_join_title({
            workspaceName: invitation()?.workspace.displayName ?? "",
          })}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div class="flex flex-col gap-6">
              <form.AppField name="name">
                {() => (
                  <TanStackTextField
                    label={m.either_invite_name_label()}
                    autofocus
                    placeholder={m.either_invite_name_placeholder()}
                    inputClass="p-3 h-auto !text-base"
                  />
                )}
              </form.AppField>

              <form.AppField name="password">
                {() => (
                  <TanStackTextField
                    label={m.either_invite_password_label()}
                    type="password"
                    placeholder={m.either_invite_password_placeholder()}
                    inputClass="p-3 h-auto !text-base"
                  />
                )}
              </form.AppField>

              <form.Subscribe>
                {(state) => (
                  <div class="flex flex-col gap-4">
                    <Button type="submit" size="lg" class="text-base" disabled={!state().canSubmit}>
                      {m.either_invite_submit()}
                    </Button>

                    <div class="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <span>{m.either_invite_already_have_account()}</span>
                      <A
                        href={`/signin?back=/invite/${params.token}`}
                        class={buttonVariants({ variant: "link", size: "sm", class: "p-0 h-auto" })}
                      >
                        {m.either_invite_signin_link()}
                      </A>
                    </div>
                  </div>
                )}
              </form.Subscribe>
            </div>
          </form>
        </AuthCard>
      </Show>
    </div>
  );
}
