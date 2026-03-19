import { test, expect, registerScenario } from "../../fixtures/index.ts";
import type { Page } from "@playwright/test";

async function openCreateIssueDialog(page: Page) {
  await page.getByTestId("sidebar-create-button").click();
  await expect(page.getByTestId("create-issue-dialog")).toBeVisible();
}

async function submitCreateIssue(page: Page, title: string) {
  const dialog = page.getByTestId("create-issue-dialog");
  await dialog.getByTestId("create-issue-summary-input").fill(title);
  await dialog.getByTestId("create-issue-submit-button").click();
}

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});
test("create issue from backlog with title only", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await openCreateIssueDialog(page);
  await submitCreateIssue(page, "My First Issue");

  await expect(page).toHaveURL(/\/issue\/TES-1$/);
  await expect(page.getByText("My First Issue")).toBeVisible();
});

test("issue key auto-increments", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await openCreateIssueDialog(page);
  await submitCreateIssue(page, "Issue Two");
  await expect(page).toHaveURL(/\/issue\/TES-2$/);

  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await openCreateIssueDialog(page);
  await submitCreateIssue(page, "Issue Three");
  await expect(page).toHaveURL(/\/issue\/TES-3$/);
});

test("title is required", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await openCreateIssueDialog(page);
  await page.getByTestId("create-issue-submit-button").click();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
});

test("create issue with custom status", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await openCreateIssueDialog(page);
  const dialog = page.getByTestId("create-issue-dialog");

  await dialog.getByTestId("create-issue-summary-input").fill("Full Issue");

  const statusTrigger = dialog.getByRole("button", { name: /status/i });
  await statusTrigger.focus();
  await statusTrigger.press("Enter");

  const pickerSearch = page.getByTestId("picker-search-input");
  await expect(pickerSearch).toBeVisible();
  await pickerSearch.press("ArrowDown");
  await pickerSearch.press("Enter");

  await dialog.getByTestId("create-issue-submit-button").click();

  await expect(page.getByText("Full Issue")).toBeVisible();
  await expect(page.getByText(/in progress/i)).toBeVisible();
});
