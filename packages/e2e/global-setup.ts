import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runDatabaseE2ECommand } from "./helpers/scenario.ts";
import { AUTH_STATE_PATH, UPLOADS_PATH } from "./paths.ts";

export default async function globalSetup() {
  mkdirSync(UPLOADS_PATH, { recursive: true });
  mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  runDatabaseE2ECommand(["run", "--silent", "e2e:prepare"]);
}
