import { Effect, Fiber } from "effect";
import { makeAppHandler } from "@blackwall/backend/src/app";
import { migrateDatabase } from "@blackwall/database/migrate";
import { jobService } from "@blackwall/queue";
import "@blackwall/backend/src/jobs/register";
import { staticFiles } from "../static-files";

interface StartOptions {
  port: string;
  publicDir: string;
  migrationsDir: string;
}

export async function start(options: StartOptions) {
  const port = parseInt(options.port, 10);

  console.log(`Running migrations from ${options.migrationsDir}`);
  try {
    await migrateDatabase(options.migrationsDir);
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  const { handleRequest, dispose } = makeAppHandler(staticFiles(options.publicDir));
  const server = Bun.serve({ port, fetch: handleRequest });
  console.log(`Server listening on port ${port}`);
  console.log(`Serving static files from ${options.publicDir}`);

  console.log("Starting job worker on queue: default");

  const workerFiber = Effect.runFork(jobService.runWorker({ queue: "default" }));

  const shutdown = () => {
    console.log("\n[blackwall] Shutting down...");
    server.stop();
    Effect.runFork(Fiber.interrupt(workerFiber));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Effect.runPromise(Fiber.await(workerFiber));
  await dispose();
}
