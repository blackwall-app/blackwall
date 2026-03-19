import { authClient } from "@/lib/auth-client";
import { query, redirect } from "@solidjs/router";

export const getSession = query(async () => {
  const session = await authClient.getSession();

  if (session.error) {
    throw new Error(session.error.message);
  }

  if (!session.data) {
    throw redirect("/signin");
  }

  return session.data;
}, "session");
