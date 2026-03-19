import { test, expect, getScenarioManifest, registerScenario } from "../../fixtures/index.ts";
import type { Page } from "@playwright/test";
import type { E2EManifest } from "../../scenarios/types.ts";

registerScenario(__filename, {
  scenario: "issue-detail-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

const SELECT_ALL_SHORTCUT = process.platform === "darwin" ? "Meta+a" : "Control+a";

async function changeIssueStatus(page: Page, statusLabel: RegExp) {
  const statusTrigger = page.getByRole("button", { name: /status/i });
  await expect(statusTrigger).toBeVisible();
  await statusTrigger.click();

  const statusOption = page.getByRole("option", { name: statusLabel });
  await expect(statusOption).toBeVisible();
  await statusOption.click();

  await expect(statusTrigger).toContainText(statusLabel);
}

test("navigate to issue detail", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await page
    .getByRole("link", { name: new RegExp(manifest.issues.primary.key) })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/issue/${manifest.issues.primary.key}`));
  await expect(page.getByRole("heading", { name: "Detail Test Issue" })).toBeVisible();
});

test("edit issue title inline", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const title = page.getByTestId("issue-summary-input");
  await title.click();
  await page.keyboard.press(SELECT_ALL_SHORTCUT);
  await page.keyboard.type("Updated Title");
  await page.getByTestId("issue-edit-save").click();

  await expect(page.getByText("Updated Title")).toBeVisible();
});

test("change status to In Progress", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await changeIssueStatus(page, /in progress/i);
});

test("change status to Done", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await changeIssueStatus(page, /^done$/i);
});

test("change priority to Urgent", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await page
    .getByRole("button", { name: /low|medium|high|urgent/i })
    .first()
    .click();
  await page.getByRole("option", { name: /urgent/i }).click();

  await expect(page.getByRole("button", { name: /urgent/i })).toBeVisible();
});

test("assign to self", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await page
    .getByRole("button", { name: /no one|unassigned|e2e user/i })
    .first()
    .click();
  await page.getByRole("option", { name: "E2E User" }).click();

  await expect(page.getByRole("button", { name: /e2e user/i })).toBeVisible();
});

test("edit rich text description", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  const editor = page.getByTestId("issue-description-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(SELECT_ALL_SHORTCUT);
  await page.keyboard.type("Test description content");
  await page.getByTestId("issue-edit-save").click();

  await page.reload();
  await expect(page.getByText("Test description content")).toBeVisible();
});

test("activity feed is visible", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);
  await expect(page.getByTestId("issue-comment-form")).toBeVisible();
  await expect(page.getByTestId("issue-activity-log")).toBeVisible();
});

test("delete issue removes it from list", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.deleteCandidate.key}`);
  await page.getByTestId("issue-menu-trigger").click();
  await page.getByRole("menuitem", { name: /delete/i }).click();
  await page
    .getByRole("button", { name: /^delete$/i })
    .last()
    .click();

  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await expect(page.getByText("Issue to Delete")).not.toBeVisible();
});
