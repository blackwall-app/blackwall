export {};

declare global {
  interface Window {
    __workspaceSlug: string;
    __applyTheme: (themeId: "system" | "light" | "dark") => void;
  }
}
