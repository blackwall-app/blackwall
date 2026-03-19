import "../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { env } from "../../zod-env";
import { deleteFile, getFile, saveFile } from "../../file-upload";

describe("file-upload", () => {
  beforeEach(() => {
    rmSync(env.FILES_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(env.FILES_DIR, { recursive: true, force: true });
  });

  it("saves files with a MIME-derived extension when the filename has none", async () => {
    const filePath = await saveFile(new File(["hello world"], "avatar", { type: "image/png" }), {
      directory: "issues",
      name: "avatar",
    });

    expect(filePath).toMatch(/avatar-[^/]+\.png$/);

    const savedFile = await getFile(filePath);
    expect(savedFile.exists).toBe(true);
    expect(await Bun.file(filePath).text()).toBe("hello world");
  });

  it("preserves the original filename extension when one is present", async () => {
    const filePath = await saveFile(
      new File(["report"], "report.custom", { type: "application/pdf" }),
      {
        directory: "docs",
        name: "report",
      },
    );

    expect(filePath).toMatch(/report-[^/]+\.custom$/);
  });

  it("rejects files with an unknown MIME type when no extension is available", async () => {
    await expect(
      saveFile(new File(["mystery"], "mystery", { type: "application/octet-stream" }), {
        directory: "unknown",
        name: "mystery",
      }),
    ).rejects.toThrow("Unknown file type");
  });

  it("deletes existing files and ignores repeated deletes", async () => {
    const filePath = await saveFile(new File(["bye"], "bye.txt", { type: "text/plain" }), {
      directory: "cleanup",
      name: "bye",
    });

    deleteFile(filePath);

    expect((await getFile(filePath)).exists).toBe(false);

    deleteFile(filePath);
    expect((await getFile(filePath)).exists).toBe(false);
  });
});
