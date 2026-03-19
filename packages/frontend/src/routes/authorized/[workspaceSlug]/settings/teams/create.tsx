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
import { api } from "@/lib/api";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { useNavigate, useParams } from "@solidjs/router";
import * as z from "zod";

export default function CreateTeamPage() {
  const params = useParams();
  const navigate = useNavigate();

  const form = useAppForm(() => ({
    defaultValues: {
      name: "",
      key: "",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, m.common_name_required()),
        key: z.string().min(1, m.settings_teams_key_required()).max(5, m.settings_teams_key_max()),
      }),
    },
    onSubmit: async ({ value }) => {
      await api.api.settings.teams.$post({
        json: {
          name: value.name,
          key: value.key.toUpperCase(),
        },
      });

      navigate(`/${params.workspaceSlug}/settings/teams`);
    },
  }));

  return (
    <>
      <Title>{m.meta_title_create_team()}</Title>
      <Meta name="description" content={m.meta_desc_create_team()} />
      <SettingsBackButton href={`/${params.workspaceSlug}/settings/teams`}>
        {m.settings_teams_back_to_management()}
      </SettingsBackButton>

      <SettingsPage title={m.settings_teams_create_page_title()}>
        <SettingsSection>
          <form
            class="w-full flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <SettingsCard>
              <SettingsRow
                title={m.common_name_label()}
                description={m.settings_teams_name_description()}
              >
                <form.AppField name="name">
                  {() => (
                    <TanStackTextField
                      id="name"
                      describedBy="name-description"
                      label={m.common_name_label()}
                      placeholder={m.settings_teams_name_placeholder()}
                      autocomplete="name"
                      labelClass="sr-only"
                      rootClass="items-end"
                    />
                  )}
                </form.AppField>
              </SettingsRow>

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
                      rootClass="items-end"
                    />
                  )}
                </form.AppField>
              </SettingsRow>
            </SettingsCard>

            <div class="ml-auto pt-4">
              <form.Subscribe>
                {(state) => (
                  <Button type="submit" size="sm" disabled={!state().canSubmit}>
                    {m.settings_teams_create_button()}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </SettingsSection>
      </SettingsPage>
    </>
  );
}
