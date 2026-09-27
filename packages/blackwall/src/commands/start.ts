import { Effect, Fiber } from "effect";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { app as apiApp, disposeEffectApi } from "@blackwall/backend/src/index";
import { migrateDatabase } from "@blackwall/database/migrate";
import { jobService } from "@blackwall/queue";
import "@blackwall/backend/src/jobs/register";

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

  const app = new Hono();
  app.route("/", apiApp);
  app.use("/*", serveStatic({ root: options.publicDir }));
  app.get("/*", serveStatic({ path: `${options.publicDir}/index.html` }));

  const server = Bun.serve({ port, fetch: app.fetch });
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
  await disposeEffectApi();
}
