import { test, expect, registerScenario } from "../../fixtures/index.ts";
import type { Page } from "@playwright/test";

registerScenario(__filename, {
  scenario: "sprints-lifecycle-basic",
  authUserRole: "primary",
});
async function openSprintDetail(page: Page, name: string) {
  await page.goto("/e2e-workspace/team/TES/sprints");
  await page.getByRole("link", { name }).click();
}

test("view sprint details", async ({ page }) => {
  await openSprintDetail(page, "View Sprint");
  await expect(page.getByRole("heading", { name: "View Sprint" })).toBeVisible();
  await expect(page.getByText("See it")).toBeVisible();
});

test("edit sprint name", async ({ page }) => {
  await openSprintDetail(page, "Edit Me Sprint");
  await page.getByRole("link", { name: /^edit$/i }).click();

  const nameInput = page.getByLabel(/^name$/i);
  await nameInput.fill("Renamed Sprint");
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page.getByRole("heading", { name: "Renamed Sprint" })).toBeVisible();
});

test("complete sprint moves unfinished issues to backlog", async ({ page }) => {
  await openSprintDetail(page, "Complete Me Sprint");
  await page.getByRole("link", { name: /complete sprint/i }).click();
  await page.getByRole("button", { name: /complete sprint/i }).click();

  await page.waitForURL(/\/sprints$/);

  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await expect(page.getByText("Leftover Issue")).toBeVisible();
});

test("start planned sprint from detail page", async ({ page }) => {
  await openSprintDetail(page, "Start Me Sprint");
  await page.getByRole("button", { name: /start sprint/i }).click();

  await expect(page.getByText(/active/i)).toBeVisible();
});

test("archive planned sprint", async ({ page }) => {
  await openSprintDetail(page, "Archive Me Sprint");
  await page.getByRole("button", { name: /archive/i }).click();
  await page
    .getByRole("button", { name: /archive/i })
    .last()
    .click();

  await page.goto("/e2e-workspace/team/TES/sprints");
  await expect(page.getByText("Archive Me Sprint")).not.toBeVisible();
});
