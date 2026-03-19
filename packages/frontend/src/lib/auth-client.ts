import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@blackwall/backend/src/features/auth/better-auth";
import { backendUrl } from "./env";

export const authClient = createAuthClient({
  baseURL: backendUrl,
  basePath: "/api/better-auth",
  plugins: [inferAdditionalFields<typeof auth>()],
});
