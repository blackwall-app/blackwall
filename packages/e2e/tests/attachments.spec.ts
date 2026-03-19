import { test, expect, getScenarioManifest, registerScenario } from "../fixtures/index.ts";
import type { Locator, Page } from "@playwright/test";
import type { E2EManifest } from "../scenarios/types.ts";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

registerScenario(__filename, {
  scenario: "attachments-basic",
  authUserRole: "primary",
});

test.describe.configure({ timeout: 20_000 });

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

const FIXTURE_DIR = path.resolve(__dirname, "../.e2e/fixtures");
const SELECT_ALL_SHORTCUT = process.platform === "darwin" ? "Meta+a" : "Control+a";

function ensureFixtureFiles() {
  mkdirSync(FIXTURE_DIR, { recursive: true });

  writeFileSync(
    path.join(FIXTURE_DIR, "test-image.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  writeFileSync(
    path.join(FIXTURE_DIR, "test-image-2.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYGD4z0ABYBxVSFUAABqWAgN4N2VNAAAAAElFTkSuQmCC",
      "base64",
    ),
  );
}

async function uploadImageFromSlashMenu(
  page: Page,
  filePath: string,
  editor: Locator,
  imageContainer: Locator,
) {
  await expect(editor).toBeVisible();
  await editor.click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.type("/image");
  await page.keyboard.press("Enter");

  const chooser = await fileChooserPromise;
  await chooser.setFiles(filePath);
  await expect(
    imageContainer.locator("img[src*='/api/issues/attachments/']").first(),
  ).toBeVisible();
}

test.beforeAll(async () => {
  ensureFixtureFiles();
});

test("upload image attachment in issue description", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const description = page.getByTestId("issue-description");
  const descriptionEditor = description.locator("[contenteditable='true']").first();
  await uploadImageFromSlashMenu(
    page,
    path.join(FIXTURE_DIR, "test-image.png"),
    descriptionEditor,
    description,
  );
  await page.getByTestId("issue-edit-save").click();

  await expect(page.locator("img[src*='/api/issues/attachments/']").first()).toBeVisible();
});

test("upload image attachment in comment", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const commentForm = page.getByTestId("issue-comment-form");
  const commentEditor = commentForm.locator("[contenteditable='true']").first();

  await uploadImageFromSlashMenu(
    page,
    path.join(FIXTURE_DIR, "test-image-2.png"),
    commentEditor,
    commentForm,
  );
  await page.getByTestId("issue-comment-submit").click();

  await expect(
    page
      .getByTestId("issue-comment-item")
      .first()
      .locator("img[src*='/api/issues/attachments/']")
      .first(),
  ).toBeVisible();
});

test("uploaded attachment persists after reload", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const description = page.getByTestId("issue-description");
  const descriptionEditor = description.locator("[contenteditable='true']").first();
  await uploadImageFromSlashMenu(
    page,
    path.join(FIXTURE_DIR, "test-image.png"),
    descriptionEditor,
    description,
  );
  await page.getByTestId("issue-edit-save").click();

  await page.reload();
  await expect(page.locator("img[src*='/api/issues/attachments/']").first()).toBeVisible();
});

test("remove attachment from issue description", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const description = page.getByTestId("issue-description");
  const descriptionEditor = description.locator("[contenteditable='true']").first();
  await uploadImageFromSlashMenu(
    page,
    path.join(FIXTURE_DIR, "test-image.png"),
    descriptionEditor,
    description,
  );
  await page.getByTestId("issue-edit-save").click();

  await descriptionEditor.click();
  await page.keyboard.press(SELECT_ALL_SHORTCUT);
  await page.keyboard.press("Backspace");
  await page.getByTestId("issue-edit-save").click();

  await page.reload();
  await expect(
    page.getByTestId("issue-description").locator("img[src*='/api/issues/attachments/']"),
  ).toHaveCount(0);
});
