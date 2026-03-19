import { type ParentComponent, Show, createEffect } from "solid-js";
import { getSession } from "./_layout.data";
import { createAsync } from "@solidjs/router";
import { SessionContext } from "@/context/session-context";
import { applyTheme } from "@/components/settings/use-theme";
import { getLocale, isLocale, localStorageKey, setLocale } from "@/paraglide/runtime.js";

const AuthorizedLayout: ParentComponent = (props) => {
  const session = createAsync(() => getSession());

  createEffect(() => {
    const data = session();
    if (!data?.user) {
      return;
    }

    const theme = data.user.preferredTheme as "system" | "light" | "dark" | undefined;
    if (theme) {
      applyTheme(theme);
    }

    if (typeof window === "undefined") {
      return;
    }

    const preferredLocale = (data.user as { preferredLocale?: string | null }).preferredLocale;

    if (preferredLocale && isLocale(preferredLocale)) {
      try {
        if (getLocale() !== preferredLocale) {
          void setLocale(preferredLocale);
        }
      } catch {
        void setLocale(preferredLocale);
      }
      return;
    }
  });

  return (
    <Show when={session()}>
      {(session) => (
        <SessionContext.Provider value={session}>{props.children}</SessionContext.Provider>
      )}
    </Show>
  );
};

export default AuthorizedLayout;
