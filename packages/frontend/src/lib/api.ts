import { hc } from "hono/client";
import type { AppType } from "@blackwall/backend/src/index";
import { toast } from "@/components/custom-ui/toast";
import { localizeErrorCode } from "@/lib/error-localization";
import { backendUrl } from "./env";

function parseErrorPayload(text: string): { code?: string; message?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "code" in parsed &&
      typeof (parsed as { code: unknown }).code === "string"
    ) {
      const code = (parsed as { code: string }).code;
      const message =
        "message" in parsed && typeof (parsed as { message: unknown }).message === "string"
          ? (parsed as { message: string }).message
          : undefined;
      return { code, message };
    }
  } catch {
    /* plain-text body */
  }
  return { message: trimmed };
}

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("x-blackwall-workspace-slug", window.__workspaceSlug!);

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    window.location.href = "/signin";
    return res;
  }

  if (!res.ok) {
    const errorText = await res.text();
    const { code, message } = parseErrorPayload(errorText);
    const displayMessage = localizeErrorCode(code, message);
    if (displayMessage) {
      console.error(code ?? "UNKNOWN", message ?? errorText);
      toast.error(displayMessage);
      throw new Error(displayMessage);
    }
  }

  return res;
};

const api = hc<AppType>(backendUrl, {
  fetch: apiFetch,
});

export { api };
