import { Schema } from "effect";

const RawEnvSchema = Schema.Struct({
  APP_BASE_URL: Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((url: string) => (URL.canParse(url) ? undefined : "Expected a valid URL")),
    ),
  ),
  APP_SECRET: Schema.String,

  GOOGLE_CLIENT_ID: Schema.optional(Schema.String),
  GOOGLE_CLIENT_SECRET: Schema.optional(Schema.String),

  SMTP_HOST: Schema.optional(Schema.String),
  SMTP_PORT: Schema.optional(Schema.FiniteFromString),
  SMTP_USER: Schema.optional(Schema.String),
  SMTP_PASS: Schema.optional(Schema.String),
  EMAIL_FROM: Schema.optional(Schema.String),

  AWS_REGION: Schema.optional(Schema.String),
  AWS_ACCESS_KEY_ID: Schema.optional(Schema.String),
  AWS_SECRET_ACCESS_KEY: Schema.optional(Schema.String),

  ARGON2_MEMORY_COST: Schema.optional(Schema.FiniteFromString),
  ARGON2_TIME_COST: Schema.optional(Schema.FiniteFromString),

  FILES_DIR: Schema.optional(Schema.String),
});

const decodeEnv = Schema.decodeUnknownSync(RawEnvSchema);

const raw: typeof RawEnvSchema.Type = (() => {
  try {
    return decodeEnv(process.env);
  } catch (cause) {
    console.error("Invalid environment variables");
    console.error(cause);
    process.exit(1);
  }
})();

export const env = {
  ...raw,
  EMAIL_FROM: raw.EMAIL_FROM ?? "Blackwall <noreply@blackwall.dev>",
  ARGON2_MEMORY_COST: raw.ARGON2_MEMORY_COST ?? 65536,
  ARGON2_TIME_COST: raw.ARGON2_TIME_COST ?? 2,
  FILES_DIR: raw.FILES_DIR ?? "blackwall_data/uploads",
};
