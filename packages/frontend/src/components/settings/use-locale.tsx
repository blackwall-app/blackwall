import type { PickerOption } from "@/components/custom-ui/picker";
import { api } from "@/lib/api";
import { m } from "@/paraglide/messages.js";
import { isLocale, locales, localStorageKey, setLocale } from "@/paraglide/runtime.js";
import { action, useAction } from "@solidjs/router";
import { createSignal } from "solid-js";

type LocaleId = (typeof locales)[number];
type LocalePreference = LocaleId | null;

function getLocaleLabel(locale: LocaleId): string {
  if (locale === "en") {
    return m.settings_locale_option_english();
  }

  if (locale === "pl") {
    return m.settings_locale_option_polish();
  }

  return locale;
}

const changeLocaleAction = action(async (locale: LocalePreference) => {
  await api.api.settings.profile.locale.$patch({
    json: { locale },
  });
});

export const useLocale = (input: { preferredLocale?: string | null }) => {
  const initialLocale = input.preferredLocale;
  const _action = useAction(changeLocaleAction);
  const [currentLocaleId, setCurrentLocaleId] = createSignal<LocalePreference>(
    isLocale(initialLocale) ? initialLocale : null,
  );

  const localeOptions: PickerOption<LocalePreference>[] = [
    {
      id: null,
      label: m.settings_locale_option_system_default(),
    },
    ...locales.map((locale) => ({
      id: locale,
      label: getLocaleLabel(locale),
    })),
  ];

  const currentLocale = () =>
    localeOptions.find((option) => option.id === currentLocaleId()) ?? localeOptions[0]!;

  const setLocalePreference = async (locale: LocalePreference) => {
    setCurrentLocaleId(locale);

    await _action(locale);

    if (locale === null) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(localStorageKey);
        window.location.reload();
      }
      return;
    }

    await setLocale(locale);
  };

  return {
    currentLocale: currentLocale as () => PickerOption<LocalePreference>,
    locales: localeOptions,
    setLocalePreference,
  };
};
