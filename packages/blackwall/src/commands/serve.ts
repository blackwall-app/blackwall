import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { app as apiApp } from "@blackwall/backend/src/index";

interface ServeOptions {
  port: string;
  publicDir: string;
}

export async function serve(options: ServeOptions) {
  const port = parseInt(options.port, 10);
  const publicDir = options.publicDir;

  const app = new Hono();

  app.route("/", apiApp);
  app.use("/*", serveStatic({ root: publicDir }));
  app.get("/*", serveStatic({ path: `${publicDir}/index.html` }));

  console.log(`Starting Blackwall server on port ${port}`);
  console.log(`Serving static files from ${publicDir}`);

  Bun.serve({
    port,
    fetch: app.fetch,
  });
}
