import { PickerPopover } from "@/components/custom-ui/picker-popover";
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-sections";
import { useLocale } from "@/components/settings/use-locale";
import { useTheme } from "@/components/settings/use-theme";
import { Button } from "@/components/ui/button";
import { useSessionData } from "@/context/session-context";
import { Title, Meta } from "@solidjs/meta";
import { m } from "@/paraglide/messages.js";
import { Popover } from "@kobalte/core/popover";
import ChevronDownIcon from "lucide-solid/icons/chevron-down";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function GeneralSettingsPage() {
  const session = useSessionData();

  return (
    <>
      <Title>{m.meta_title_settings()}</Title>
      <Meta name="description" content={m.meta_desc_settings()} />
      <SettingsPage title={m.settings_general_page_title()}>
        <SettingsSection title={m.settings_general_ui_section_title()}>
          <SettingsCard>
            <SettingsRow
              title={m.settings_general_theme_title()}
              description={m.settings_general_theme_description()}
            >
              <ThemeSelector />
            </SettingsRow>
            <SettingsRow
              title={m.settings_general_language_title()}
              description={m.settings_general_language_description()}
            >
              <LocaleSelector
                preferredLocale={
                  (session().user as { preferredLocale?: string | null }).preferredLocale
                }
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
    </>
  );
}

function ThemeSelector() {
  const { currentTheme, setTheme, themes } = useTheme();

  return (
    <Popover>
      <Popover.Trigger as={Button} variant="outline">
        <Show when={currentTheme().icon}>
          <Dynamic component={currentTheme().icon} class="size-4 shrink-0" />
        </Show>
        {currentTheme().label}
        <ChevronDownIcon class="size-4" />
      </Popover.Trigger>

      <PickerPopover options={themes} value={currentTheme().id} onChange={setTheme} />
    </Popover>
  );
}

function LocaleSelector(props: { preferredLocale?: string | null }) {
  const { currentLocale, setLocalePreference, locales } = useLocale({
    preferredLocale: props.preferredLocale,
  });

  return (
    <Popover>
      <Popover.Trigger as={Button} variant="outline">
        {currentLocale().label}
        <ChevronDownIcon class="size-4" />
      </Popover.Trigger>

      <PickerPopover options={locales} value={currentLocale().id} onChange={setLocalePreference} />
    </Popover>
  );
}
