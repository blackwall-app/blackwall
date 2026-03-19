import { authClient } from "@/lib/auth-client";
import { query, redirect } from "@solidjs/router";

export const redirectIfSession = query(async () => {
  const session = await authClient.getSession();

  if (session.error) {
    throw new Error(session.error.message);
  }

  if (session.data) {
    const back =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("back")
        : null;
    const safeBack = back && back.startsWith("/") ? back : "/";
    throw redirect(safeBack);
  }

  return session.data;
}, "redirect-if-session");
