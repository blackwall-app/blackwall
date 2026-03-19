import { resolve } from "node:path";

process.env.DATABASE_URL ??= ":memory:";
process.env.APP_SECRET ??= "TESTING_SECRET";
process.env.ARGON2_MEMORY_COST ??= "4";
process.env.ARGON2_TIME_COST ??= "2";
process.env.FILES_DIR ??= ".test-uploads";
process.env.APP_BASE_URL ??= "http://localhost:8000";
process.env.MIGRATIONS_DIR ??= resolve(import.meta.dir, "../../../database/src/migrations");
