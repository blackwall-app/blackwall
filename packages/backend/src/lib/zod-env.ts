import * as z from "zod";

export const envSchema = z.object({
  APP_BASE_URL: z.url(),
  APP_SECRET: z.string(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional().default("Blackwall <noreply@blackwall.dev>"),

  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  ARGON2_MEMORY_COST: z.coerce.number().optional().default(65536),
  ARGON2_TIME_COST: z.coerce.number().optional().default(2),

  FILES_DIR: z.string().optional().default("blackwall_data/uploads"),
});

const env_internal = envSchema.safeParse(process.env);

if (!env_internal.success) {
  console.error("Invalid environment variables");
  console.error(z.treeifyError(env_internal.error));
  process.exit(1);
}

export const env = env_internal.data;
