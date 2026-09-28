import { BunFileSystem, BunHttpPlatform, BunPath } from "@effect/platform-bun";
import { Layer } from "effect";
import { HttpStaticServer } from "effect/unstable/http";

/** Serves the built frontend, falling back to `index.html` for client-side routes. */
export const staticFiles = (publicDir: string) =>
  HttpStaticServer.layer({ root: publicDir, spa: true }).pipe(
    Layer.provide(Layer.mergeAll(BunHttpPlatform.layer, BunFileSystem.layer, BunPath.layer)),
  );
