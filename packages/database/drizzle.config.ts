import { dbEnv } from "./src/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: { url: dbEnv.DATABASE_URL },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
