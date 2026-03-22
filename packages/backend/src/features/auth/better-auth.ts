import { env } from "../../lib/zod-env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "@blackwall/database";
import { jobService } from "@blackwall/queue";

const hashOptions = {
  algorithm: "argon2id" as const,
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
};

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, hashOptions);
}

async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  return Bun.password.verify(data.password, data.hash);
}

const logger =
  process.env.NODE_ENV === "test"
    ? {
        level: "error" as const,
        log(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) {
          if (level === "error") {
            return;
          }

          if (level === "warn") {
            console.warn(`[Better Auth]: ${message}`, ...args);
            return;
          }

          console.log(`[Better Auth]: ${message}`, ...args);
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  basePath: "/api/better-auth",
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    sendResetPassword: async ({ user, token }) => {
      await jobService.addJob({
        type: "reset-password-email",
        payload: {
          email: user.email,
          resetUrl: `${env.APP_BASE_URL}/reset-password?token=${token}`,
        },
      });
    },
  },
  baseURL: env.APP_BASE_URL,
  secret: env.APP_SECRET,
  logger,
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [openAPI()],
  disabledPaths: ["/sign-up/email", "/change-password"],
  user: {
    additionalFields: {
      lastWorkspaceId: {
        type: "string",
        fieldName: "lastWorkspaceId",
        input: false,
      },
      lastTeamId: {
        type: "string",
        fieldName: "lastTeamId",
        input: false,
      },
      preferredTheme: {
        type: "string",
        fieldName: "preferredTheme",
        input: false,
      },
      preferredLocale: {
        type: "string",
        fieldName: "preferredLocale",
        input: false,
      },
    },
  },
});
