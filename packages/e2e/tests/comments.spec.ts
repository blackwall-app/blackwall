import { test, expect, getScenarioManifest, registerScenario } from "../fixtures/index.ts";
import type { Page } from "@playwright/test";
import type { E2EManifest } from "../scenarios/types.ts";

registerScenario(__filename, {
  scenario: "comments-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

const BOLD_SHORTCUT = process.platform === "darwin" ? "Meta+b" : "Control+b";

async function addComment(page: Page, text: string) {
  const form = page.getByTestId("issue-comment-form");
  const editor = page.getByTestId("issue-comment-editor");

  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type(text);
  await form.getByTestId("issue-comment-submit").click();
}

test("add plain text comment", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await addComment(page, "First comment");

  await expect(page.getByText("First comment")).toBeVisible();
  await expect(page.getByText("E2E User")).toBeVisible();
});

test("add bold text in comment", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const form = page.getByTestId("issue-comment-form");
  const editor = page.getByTestId("issue-comment-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(BOLD_SHORTCUT);
  await page.keyboard.type("Bold text");
  await form.getByTestId("issue-comment-submit").click();

  const comment = page.getByTestId("issue-comment-item").filter({ hasText: "Bold text" }).first();
  await expect(comment.locator("strong, b")).toBeVisible();
});

test("delete own comment", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await addComment(page, "Delete me comment");
  await expect(page.getByText("Delete me comment")).toBeVisible();

  const comment = page
    .getByTestId("issue-comment-item")
    .filter({ hasText: "Delete me comment" })
    .first();
  await comment.getByRole("button", { name: /more/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await deleteDialog.getByRole("button", { name: /^delete$/i }).click();

  await expect(page.getByText("Delete me comment")).not.toBeVisible();
});

test("multiple comments are displayed", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await addComment(page, "Comment one");
  await addComment(page, "Comment two");

  await expect(page.getByText("Comment one")).toBeVisible();
  await expect(page.getByText("Comment two")).toBeVisible();
});

test("comment persists after reload", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await addComment(page, "Persistent comment");
  await page.reload();

  await expect(page.getByText("Persistent comment")).toBeVisible();
});
