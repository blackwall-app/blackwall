import { makeAppHandler } from "@blackwall/backend/src/app";
import { staticFiles } from "../static-files";

interface ServeOptions {
  port: string;
  publicDir: string;
}

export async function serve(options: ServeOptions) {
  const port = parseInt(options.port, 10);
  const publicDir = options.publicDir;

  const { handleRequest } = makeAppHandler(staticFiles(publicDir));

  console.log(`Starting Blackwall server on port ${port}`);
  console.log(`Serving static files from ${publicDir}`);

  Bun.serve({
    port,
    fetch: handleRequest,
  });
}
