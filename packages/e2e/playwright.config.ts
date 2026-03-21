import { defineConfig, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { APP_BASE_URL, BACKEND_URL, DB_PATH, UPLOADS_PATH } from "./paths.ts";

mkdirSync(path.dirname(DB_PATH), { recursive: true });

const APP_SECRET = process.env.APP_SECRET ?? "e2e-test-secret";
const ARGON2_MEMORY_COST = process.env.ARGON2_MEMORY_COST ?? "8192";
const ARGON2_TIME_COST = process.env.ARGON2_TIME_COST ?? "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 10_000,
  reporter: [["html"], ["list"], ["json", { outputFile: "test-results/results.json" }]],
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  use: {
    baseURL: APP_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "safari", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "bun run dev:e2e",
      cwd: "../../packages/backend",
      url: `${BACKEND_URL}/api/docs`,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: DB_PATH,
        FILES_DIR: UPLOADS_PATH,
        APP_SECRET,
        APP_BASE_URL,
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
      },
    },
    {
      command: "bun run dev:e2e",
      cwd: "../../packages/frontend",
      url: APP_BASE_URL,
      env: {
        ...process.env,
        VITE_BACKEND_URL: BACKEND_URL,
      },
    },
  ],
});
