import { resolve } from "node:path";

process.env.DATABASE_URL ??= ":memory:";
process.env.MIGRATIONS_DIR ??= resolve(import.meta.dir, "../../../database/src/migrations");
