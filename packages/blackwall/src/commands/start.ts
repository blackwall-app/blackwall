import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { app as apiApp } from "@blackwall/backend/src/index";
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

  const controller = new AbortController();

  const shutdown = () => {
    console.log("\n[blackwall] Shutting down...");
    controller.abort();
    server.stop();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Starting job worker on queue: default");

  await jobService.runWorker({
    queue: "default",
    signal: controller.signal,
  });
}
