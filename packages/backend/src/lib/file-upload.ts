import { existsSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { env } from "./zod-env";

const SAVE_PATH = env.FILES_DIR;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

function getExtension(file: File): string {
  const originalExt = extname(file.name);
  if (originalExt) return originalExt;
  const byMime = MIME_TO_EXT[file.type];
  if (!byMime) throw new Error("Unknown file type");
  return byMime;
}

type SaveFileOptions = {
  /** Directory path relative to blackwall_data/uploads/ */
  directory: string;
  /** File name */
  name: string;
};

/**
 * Get a file by its full path
 */
export async function getFile(filePath: string): Promise<{ file: Bun.BunFile; exists: boolean }> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  return { file, exists };
}

/**
 * Save a file and return its full path
 */
export async function saveFile(file: File, options: SaveFileOptions): Promise<string> {
  const ext = getExtension(file);
  const filename = `${options.name}-${crypto.randomUUID()}${ext}`;

  const dirPath = join(SAVE_PATH, options.directory);
  const filePath = join(dirPath, filename);

  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }

  await Bun.write(filePath, file);

  return filePath;
}

/**
 * Delete a file by its full path
 */
export function deleteFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    console.log("Failed to delete file", filePath);
  }
}
