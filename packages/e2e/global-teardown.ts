import { rmSync } from "node:fs";
import path from "node:path";
import { DB_PATH } from "./paths.ts";

export default function globalTeardown() {
  rmSync(path.dirname(DB_PATH), { recursive: true, force: true });
}
