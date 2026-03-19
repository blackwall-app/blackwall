import path from "node:path";

const E2E_ROOT = __dirname;
export const REPO_ROOT = path.resolve(E2E_ROOT, "../..");
export const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3100";
export const BACKEND_URL = process.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export const DB_PATH = path.resolve(E2E_ROOT, process.env.DATABASE_URL ?? ".e2e/test.db");
export const UPLOADS_PATH = path.resolve(E2E_ROOT, process.env.FILES_DIR ?? ".e2e/uploads");
export const AUTH_STATE_PATH = path.resolve(E2E_ROOT, "fixtures/.auth/user.json");
