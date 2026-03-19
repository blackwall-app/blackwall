import { InviteDialogContent } from "@/components/blocks/invite-dialog";
import { UserAvatar } from "@/components/custom-ui/avatar";
import { toast } from "@/components/custom-ui/toast";
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-sections";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { useSessionData } from "@/context/session-context";
import { useWorkspaceData } from "@/context/workspace-context";
import { api } from "@/lib/api";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { createAsync, useParams } from "@solidjs/router";
import { Index, Show } from "solid-js";
import * as z from "zod";
import { workspaceMembersLoader } from "./workspace.data";

export default function WorkspaceSettingsPage() {
  const workspaceData = useWorkspaceData();
  const ids = {
    displayName: {
      field: "workspace-display-name",
      description: "workspace-display-name-description",
    },
  } as const;

  return (
    <>
      <Title>{m.meta_title_workspace_settings()}</Title>
      <Meta name="description" content={m.meta_desc_workspace_settings()} />
      <SettingsPage title={m.settings_workspace_page_title()}>
        <SettingsSection title={m.settings_workspace_section_details()}>
          <SettingsCard>
            <SettingsRow
              title={m.settings_workspace_name_title()}
              description={m.settings_workspace_name_description()}
              htmlFor={ids.displayName.field}
              descriptionId={ids.displayName.description}
            >
              <WorkspaceNameForm
                defaultName={workspaceData().workspace.displayName}
                workspaceId={workspaceData().workspace.id}
                inputId={ids.displayName.field}
                descriptionId={ids.displayName.description}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={m.settings_workspace_section_members()}>
          <MembersSection />
        </SettingsSection>
      </SettingsPage>
    </>
  );
}

type WorkspaceNameFormProps = {
  defaultName: string;
  workspaceId: string;
  inputId: string;
  descriptionId: string;
};

function WorkspaceNameForm(props: WorkspaceNameFormProps) {
  const form = useAppForm(() => ({
    defaultValues: {
      name: props.defaultName,
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .min(1, m.settings_workspace_name_required())
          .max(100, m.settings_workspace_name_too_long()),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await api.api.settings.workspace.$patch({
          json: { displayName: value.name },
        });
        toast.success(m.settings_workspace_toast_name_updated());
        form.reset({ name: value.name });
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
  }));

  const submitOnBlur = () => {
    queueMicrotask(() => {
      const state = form.state;
      if (state.canSubmit && state.isDirty && !state.isSubmitting) {
        form.handleSubmit();
      }
    });
  };

  return (
    <form
      class="contents"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.AppField name="name">
        {() => (
          <TanStackTextField
            id={props.inputId}
            describedBy={props.descriptionId}
            label={m.settings_workspace_name_title()}
            placeholder={m.settings_workspace_name_placeholder()}
            labelClass="sr-only"
            onBlur={submitOnBlur}
          />
        )}
      </form.AppField>
    </form>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return m.common_error_generic();
}

function MembersSection() {
  const params = useParams();
  const session = useSessionData();
  const membersData = createAsync(() => workspaceMembersLoader(params.workspaceSlug!));

  const memberCount = () => membersData()?.length ?? 0;

  return (
    <SettingsCard variant="column">
      <div class="flex items-center justify-between px-4 pb-2">
        <p class="text-sm text-muted-foreground">
          {m.common_member_count({ count: String(memberCount()) })}
        </p>

        <div class="flex items-center gap-2">
          <Dialog>
            <DialogTrigger
              as={Button}
              variant="outline"
              size="sm"
              data-testid="workspace-settings-invite-trigger"
            >
              {m.common_invite()}
            </DialogTrigger>
            <InviteDialogContent />
          </Dialog>
        </div>
      </div>

      <div
        class="flex flex-col divide-y divide-border"
        data-testid="workspace-settings-members-list"
      >
        <Show
          when={memberCount() > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <p class="text-sm text-muted-foreground">
                {m.settings_workspace_members_empty_title()}
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {m.settings_workspace_members_empty_description()}
              </p>
            </div>
          }
        >
          <Index each={membersData() ?? []}>
            {(member) => {
              const isCurrentUser = () => member().id === session().user.id;

              return (
                <div class="group flex items-center justify-between gap-4 px-4 py-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <UserAvatar user={member()} size="sm" />
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate">{member().name}</span>
                        <Show when={isCurrentUser()}>
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                            {m.common_you_badge()}
                          </span>
                        </Show>
                      </div>
                      <Show when={member().email}>
                        <span class="text-xs text-muted-foreground truncate">{member().email}</span>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            }}
          </Index>
        </Show>
      </div>
    </SettingsCard>
  );
}
