import { mkdirSync } from "node:fs";
import path from "node:path";
import { e2eScenarioNames, type E2EManifest, type E2EScenarioName } from "./types.ts";

type SeedOptions = {
  json: boolean;
  scenario: E2EScenarioName;
};

function parseOptions(argv: string[]): SeedOptions {
  let json = false;
  let scenario: E2EScenarioName | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) {
      continue;
    }

    if (current === "--json") {
      json = true;
      continue;
    }

    if (current === "--scenario") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --scenario");
      }

      if (!e2eScenarioNames.includes(next as E2EScenarioName)) {
        throw new Error(`Unknown scenario: ${next}`);
      }

      scenario = next as E2EScenarioName;
      index += 1;
      continue;
    }

    if (current.startsWith("--scenario=")) {
      const value = current.slice("--scenario=".length);
      if (!e2eScenarioNames.includes(value as E2EScenarioName)) {
        throw new Error(`Unknown scenario: ${value}`);
      }
      scenario = value as E2EScenarioName;
    }
  }

  if (!scenario) {
    throw new Error("Missing required --scenario flag");
  }

  return { json, scenario };
}

function printManifest(manifest: E2EManifest, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
    return;
  }

  console.log(`Seeded scenario: ${manifest.workspaceSlug}/${manifest.teamKey}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    mkdirSync(path.dirname(databaseUrl), { recursive: true });
  }

  const [{ resetAllTables }, { seedE2EScenario }] = await Promise.all([
    import("./reset.ts"),
    import("./scenarios.ts"),
  ]);

  const options = parseOptions(Bun.argv.slice(2));
  await resetAllTables();
  const manifest = await seedE2EScenario(options.scenario);
  printManifest(manifest, options.json);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
