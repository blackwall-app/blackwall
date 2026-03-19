import { UserAvatar } from "@/components/custom-ui/avatar";
import type { PickerOption } from "@/components/custom-ui/picker";
import { PickerPopover } from "@/components/custom-ui/picker-popover";
import { toast } from "@/components/custom-ui/toast";
import {
  SettingsBackButton,
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-sections";
import { Button } from "@/components/ui/button";
import { TanStackTextField } from "@/components/ui/text-field";
import { useAppForm } from "@/context/form-context";
import { useSessionData } from "@/context/session-context";
import { api } from "@/lib/api";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { Popover } from "@kobalte/core/popover";
import { createAsync, revalidate, useNavigate, useParams } from "@solidjs/router";
import PlusIcon from "lucide-solid/icons/plus";
import XIcon from "lucide-solid/icons/x";
import { createMemo, createSignal, Index, Show } from "solid-js";
import * as z from "zod";
import { teamSettingsLoader, availableUsersLoader } from "./[teamKey].data";

export default function TeamDetailPage() {
  const params = useParams();
  const teamData = createAsync(() => teamSettingsLoader(params.teamKey!));

  return (
    <>
      <Title>{m.meta_title_team_settings()}</Title>
      <Meta name="description" content={m.meta_desc_team_settings()} />
      <Show when={teamData()}>
        {(data) => (
          <>
            <SettingsBackButton href={`/${params.workspaceSlug}/settings/teams`}>
              {m.settings_teams_back_to_management()}
            </SettingsBackButton>
            <SettingsPage title={data().team.name}>
              <SettingsSection>
                <SettingsCard>
                  <NameForm defaultName={data().team.name} />
                  <KeyForm defaultKey={data().team.key} />
                </SettingsCard>
              </SettingsSection>
              <SettingsSection title={m.settings_teams_members_section_title()}>
                <MembersSection members={data().teamMembers} />
              </SettingsSection>
            </SettingsPage>
          </>
        )}
      </Show>
    </>
  );
}

type NameFormProps = {
  defaultName: string;
};

function NameForm(props: NameFormProps) {
  const params = useParams();

  const form = useAppForm(() => ({
    defaultValues: {
      name: props.defaultName,
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, m.common_name_required()),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await api.api.settings.teams[":teamKey"].$patch({
          param: { teamKey: params.teamKey! },
          json: { name: value.name },
        });

        toast.success(m.settings_teams_toast_name_updated());
        revalidate("teamSettings");
      } catch {
        toast.error(m.settings_teams_toast_name_update_failed());
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
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <SettingsRow title={m.common_name_label()} description={m.settings_teams_name_description()}>
        <form.AppField name="name">
          {() => (
            <TanStackTextField
              id="name"
              describedBy="name-description"
              label={m.common_name_label()}
              placeholder={m.settings_teams_name_placeholder()}
              autocomplete="name"
              labelClass="sr-only"
              onBlur={submitOnBlur}
            />
          )}
        </form.AppField>
      </SettingsRow>
    </form>
  );
}

type KeyFormProps = {
  defaultKey: string;
};

function KeyForm(props: KeyFormProps) {
  const params = useParams();
  const navigate = useNavigate();

  const form = useAppForm(() => ({
    defaultValues: {
      key: props.defaultKey,
    },
    validators: {
      onSubmit: z.object({
        key: z.string().min(1, m.settings_teams_key_required()).max(5, m.settings_teams_key_max()),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        await api.api.settings.teams[":teamKey"].$patch({
          param: { teamKey: params.teamKey! },
          json: { key: value.key.toUpperCase() },
        });

        toast.success(m.settings_teams_toast_key_updated());

        if (value.key.toUpperCase() !== props.defaultKey) {
          navigate(`/${params.workspaceSlug}/settings/teams/${value.key.toUpperCase()}`);
        }
      } catch {
        toast.error(m.settings_teams_toast_key_update_failed());
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
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <SettingsRow
        title={m.settings_teams_key_title()}
        description={m.settings_teams_key_description()}
      >
        <form.AppField name="key">
          {() => (
            <TanStackTextField
              id="key"
              describedBy="key-description"
              label={m.settings_teams_key_title()}
              placeholder={m.settings_teams_key_placeholder()}
              autocomplete="key"
              labelClass="sr-only"
              onBlur={submitOnBlur}
            />
          )}
        </form.AppField>
      </SettingsRow>
    </form>
  );
}

type MembersSectionProps = {
  members: { id: string; name: string; email: string | null; image: string | null }[];
};

function MembersSection(props: MembersSectionProps) {
  const params = useParams();
  const session = useSessionData();
  const [open, setOpen] = createSignal(false);

  const availableUsers = createAsync(() =>
    open() ? availableUsersLoader(params.teamKey!) : Promise.resolve([]),
  );

  const availableUsersOptions = createMemo((): PickerOption<string>[] => {
    const users = availableUsers() ?? [];
    return users.map((user) => ({
      id: user.id,
      label: user.name,
      icon: () => <UserAvatar user={user} size="xs" />,
    }));
  });

  const handleAddMember = async (userId: string) => {
    try {
      await api.api.settings.teams[":teamKey"].members.$post({
        param: { teamKey: params.teamKey! },
        json: { userId },
      });

      toast.success(m.settings_teams_toast_member_added());
      revalidate("teamSettings");
      revalidate("availableUsers");
      setOpen(false);
    } catch {
      toast.error(m.settings_teams_toast_member_add_failed());
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await api.api.settings.teams[":teamKey"].members[":userId"].$delete({
        param: { teamKey: params.teamKey!, userId },
      });

      toast.success(m.settings_teams_toast_member_removed());
      revalidate("teamSettings");
    } catch {
      toast.error(m.settings_teams_toast_member_remove_failed());
    }
  };

  const memberCount = () => props.members.length;

  return (
    <SettingsCard variant="column">
      <div class="flex items-center justify-between px-4 pb-2">
        <p class="text-sm text-muted-foreground">
          {m.common_member_count({ count: String(memberCount()) })}
        </p>

        <div class="flex items-center gap-2">
          <Popover open={open()} onOpenChange={setOpen} placement="bottom-end" gutter={8}>
            <Popover.Trigger as={Button} variant="outline" size="sm">
              <PlusIcon class="size-4" />
              {m.settings_teams_add_member_button()}
            </Popover.Trigger>
            <PickerPopover
              value={undefined}
              onChange={(userId: string | null) => {
                if (userId) {
                  handleAddMember(userId);
                }
              }}
              options={availableUsersOptions()}
              emptyText={
                availableUsersOptions().length === 0
                  ? m.settings_teams_all_workspace_members_already_added()
                  : undefined
              }
            />
          </Popover>
        </div>
      </div>

      <div class="flex flex-col divide-y divide-border">
        <Show
          when={memberCount() > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <p class="text-sm text-muted-foreground">{m.settings_teams_members_empty_title()}</p>
              <p class="text-xs text-muted-foreground mt-1">
                {m.settings_teams_members_empty_description()}
              </p>
            </div>
          }
        >
          <Index each={props.members}>
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
                  <Show when={!isCurrentUser()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(member().id)}
                      aria-label={m.settings_teams_remove_member_aria_label({
                        name: member().name,
                      })}
                    >
                      <XIcon class="size-4" />
                    </Button>
                  </Show>
                </div>
              );
            }}
          </Index>
        </Show>
      </div>
    </SettingsCard>
  );
}
