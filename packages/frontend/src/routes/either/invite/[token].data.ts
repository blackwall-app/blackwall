import { query } from "@solidjs/router";
import { api } from "@/lib/api";

export const invitationLoader = query(async (token: string) => {
  const res = await api.api.invitations[":token"].$get({
    param: { token },
  });

  const { invitation } = await res.json();
  return invitation;
}, "invitation");
