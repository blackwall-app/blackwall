import { jobService } from "@blackwall/queue";
// Register all job handlers
import "@blackwall/backend/src/jobs/register";

interface WorkerOptions {
  pollIntervalMs?: string;
  staleCheckIntervalMs?: string;
  cleanupIntervalMs?: string;
  lockDurationMs?: string;
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
};

export async function worker(options: WorkerOptions) {
  const controller = new AbortController();

  process.on("SIGINT", () => {
    console.log("\n[worker] Shutting down...");
    controller.abort();
  });

  process.on("SIGTERM", () => {
    console.log("\n[worker] Shutting down...");
    controller.abort();
  });

  console.log("Starting job worker on queue: default");

  await jobService.runWorker({
    queue: "default",
    pollIntervalMs: parseNumber(options.pollIntervalMs),
    staleCheckIntervalMs: parseNumber(options.staleCheckIntervalMs),
    cleanupIntervalMs: parseNumber(options.cleanupIntervalMs),
    lockDurationMs: parseNumber(options.lockDurationMs),
    signal: controller.signal,
  });
}
