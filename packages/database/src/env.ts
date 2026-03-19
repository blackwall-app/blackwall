import * as z from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
});

const env_internal = envSchema.safeParse(process.env);

if (!env_internal.success) {
  console.error("Invalid environment variables for database");
  console.error(z.treeifyError(env_internal.error));
  process.exit(1);
}

export const dbEnv = env_internal.data;
