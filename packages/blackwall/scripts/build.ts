import { $ } from "bun";
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const DIST_DIR = join(ROOT_DIR, "dist");
const PACKAGES_DIR = join(ROOT_DIR, "..");

async function build() {
  console.log("Building Blackwall...\n");

  rmSync(join(DIST_DIR, "public"), { recursive: true, force: true });
  rmSync(join(DIST_DIR, "migrations"), { recursive: true, force: true });
  rmSync(join(DIST_DIR, "blackwall"), { force: true });

  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  if (!existsSync(join(DIST_DIR, "blackwall_data"))) {
    mkdirSync(join(DIST_DIR, "blackwall_data"), { recursive: true });
  }

  console.log("Building frontend...");
  await $`bun run build`.cwd(join(PACKAGES_DIR, "frontend"));

  console.log("\nCompiling CLI binary...");
  const output = await Bun.build({
    entrypoints: [join(ROOT_DIR, "src/index.ts")],
    minify: true,
    compile: {
      outfile: join(DIST_DIR, "blackwall"),
    },
  });

  console.log(output);

  console.log("\nCopying frontend assets...");
  cpSync(join(PACKAGES_DIR, "frontend/dist"), join(DIST_DIR, "public"), { recursive: true });

  console.log("Copying migrations...");
  cpSync(join(PACKAGES_DIR, "database/src/migrations"), join(DIST_DIR, "migrations"), {
    recursive: true,
  });

  if (process.platform === "darwin") {
    console.log("\nSigning binary (macOS)...");
    const binary = join(DIST_DIR, "blackwall");
    await $`codesign --remove-signature ${binary}`.quiet();
    await $`codesign --sign - ${binary}`;
  }

  console.log("\nBuild complete!");
  console.log(`Output: ${DIST_DIR}/`);
  console.log("  - blackwall (CLI binary)");
  console.log("  - public/ (frontend assets)");
  console.log("  - migrations/ (database migrations)");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
