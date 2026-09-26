import { Schema } from "effect";

const DbEnvSchema = Schema.Struct({
  DATABASE_URL: Schema.String,
});

const decodeDbEnv = Schema.decodeUnknownSync(DbEnvSchema);

export const dbEnv: typeof DbEnvSchema.Type = (() => {
  try {
    return decodeDbEnv(process.env);
  } catch (cause) {
    console.error("Invalid environment variables for database");
    console.error(cause);
    process.exit(1);
  }
})();
