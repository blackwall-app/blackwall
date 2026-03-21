import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { prepareScenario } from "../helpers/scenario.ts";
import { AUTH_STATE_PATH } from "../paths.ts";
import type { E2EManifest, E2EScenarioName } from "../scenarios/types.ts";

type RegisteredScenario = {
  scenario: E2EScenarioName;
  authUserRole?: string;
  resetOnEachTest?: boolean;
};

const registeredScenarios = new Map<string, RegisteredScenario>();
const preparedScenarioPromises = new Map<string, Promise<E2EManifest>>();
const preparedScenarioManifests = new Map<string, E2EManifest>();

function fileKey(file: string) {
  return path.resolve(file);
}

async function ensureScenarioPrepared(file: string) {
  const key = fileKey(file);
  const config = registeredScenarios.get(key);
  if (!config) {
    return null;
  }

  if (config.resetOnEachTest) {
    preparedScenarioPromises.delete(key);
  }

  let manifestPromise = preparedScenarioPromises.get(key);
  if (!manifestPromise) {
    manifestPromise = prepareScenario(config.scenario, {
      authUserRole: config.authUserRole,
    });
    preparedScenarioPromises.set(key, manifestPromise);
  }

  const manifest = await manifestPromise;
  preparedScenarioManifests.set(key, manifest);
  return manifest;
}

export function registerScenario(file: string, config: RegisteredScenario) {
  registeredScenarios.set(fileKey(file), config);
}

export function getScenarioManifest<TManifest extends E2EManifest = E2EManifest>(file: string) {
  const manifest = preparedScenarioManifests.get(fileKey(file));

  if (!manifest) {
    throw new Error(`No prepared scenario manifest found for ${file}`);
  }

  return manifest as TManifest;
}

export const test = base.extend<{
  preparedScenario: E2EManifest | null;
}>({
  preparedScenario: [
    async (_, use, testInfo) => {
      await use(await ensureScenarioPrepared(testInfo.file));
    },
    { auto: true },
  ],
  storageState: async (_, use, testInfo) => {
    const config = registeredScenarios.get(fileKey(testInfo.file));
    await use(config?.authUserRole ? AUTH_STATE_PATH : undefined);
  },
});

export { expect };
