import { Effect, Fiber } from "effect";
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
  console.log("Starting job worker on queue: default");

  const fiber = Effect.runFork(
    jobService.runWorker({
      queue: "default",
      pollIntervalMs: parseNumber(options.pollIntervalMs),
      staleCheckIntervalMs: parseNumber(options.staleCheckIntervalMs),
      cleanupIntervalMs: parseNumber(options.cleanupIntervalMs),
      lockDurationMs: parseNumber(options.lockDurationMs),
    }),
  );

  const shutdown = () => {
    console.log("\n[worker] Shutting down...");
    Effect.runFork(Fiber.interrupt(fiber));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (err) => {
    console.error("[worker] Uncaught exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[worker] Unhandled promise rejection:", reason);
  });

  await Effect.runPromise(Fiber.await(fiber));
}
