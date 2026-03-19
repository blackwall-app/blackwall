import { hc } from "hono/client";
import type { AppType } from "@blackwall/backend/src/index";
import { toast } from "@/components/custom-ui/toast";
import { backendUrl } from "./env";

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
    if (errorText) {
      console.error(errorText);
      toast.error(errorText);
      throw new Error(errorText);
    }
  }

  return res;
};

const api = hc<AppType>(backendUrl, {
  fetch: apiFetch,
});

export { api };
