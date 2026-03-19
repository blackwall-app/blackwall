import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import type { E2EManifest, E2EManifestUser, E2EScenarioName } from "../scenarios/types.ts";
import { AUTH_STATE_PATH, BACKEND_URL, DB_PATH, REPO_ROOT } from "../paths.ts";

type PrepareScenarioOptions = {
  authUserRole?: string;
};

const EMPTY_STORAGE_STATE = {
  cookies: [],
  origins: [],
};

function databaseEnv() {
  return {
    ...process.env,
    DATABASE_URL: DB_PATH,
  };
}

export function runDatabaseE2ECommand(args: string[]) {
  const result = spawnSync("bun", args, {
    cwd: path.join(REPO_ROOT, "packages/database"),
    env: databaseEnv(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `Database e2e command failed: bun ${args.join(" ")}`,
    );
  }

  return result.stdout;
}

export function runE2ESeedCommand(args: string[]) {
  const result = spawnSync("bun", args, {
    cwd: path.join(REPO_ROOT, "packages/e2e"),
    env: databaseEnv(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `E2E seed command failed: bun ${args.join(" ")}`,
    );
  }

  return result.stdout;
}

export async function createStorageStateForUser(
  user: E2EManifestUser,
): Promise<Awaited<ReturnType<APIRequestContext["storageState"]>>> {
  const apiContext = await request.newContext({
    baseURL: BACKEND_URL,
    storageState: EMPTY_STORAGE_STATE,
  });

  const response = await apiContext.post("/api/better-auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    await apiContext.dispose();
    throw new Error(`Failed to sign in ${user.email}: ${response.status()} ${body}`);
  }

  const storageState = await apiContext.storageState();
  await apiContext.dispose();
  return storageState;
}

export async function writeStorageStateForUser(user: E2EManifestUser) {
  mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  const storageState = await createStorageStateForUser(user);
  writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
}

export async function prepareScenario(
  scenario: E2EScenarioName,
  options: PrepareScenarioOptions = {},
): Promise<E2EManifest> {
  const stdout = runE2ESeedCommand([
    "run",
    "--silent",
    "e2e:seed",
    "--",
    "--scenario",
    scenario,
    "--json",
  ]);

  const manifest = JSON.parse(stdout.trim()) as E2EManifest;

  if (options.authUserRole) {
    const user = manifest.users[options.authUserRole];
    if (!user) {
      throw new Error(
        `Scenario "${scenario}" did not provide auth user role "${options.authUserRole}"`,
      );
    }
    await writeStorageStateForUser(user);
  }

  return manifest;
}

export async function createAuthedApiContext(user: E2EManifestUser): Promise<APIRequestContext> {
  const storageState = await createStorageStateForUser(user);
  return request.newContext({
    baseURL: BACKEND_URL,
    storageState,
  });
}

export async function createAuthedBrowserContext(
  browser: Browser,
  user: E2EManifestUser,
): Promise<BrowserContext> {
  const storageState = await createStorageStateForUser(user);
  return browser.newContext({ storageState });
}
