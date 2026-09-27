import { query } from "@solidjs/router";
import { runApi } from "@/lib/api-effect";

export const invitationLoader = query(async (token: string) => {
  const { invitation } = await runApi((client) => client.invitations.get({ params: { token } }));
  return invitation;
}, "invitation");
