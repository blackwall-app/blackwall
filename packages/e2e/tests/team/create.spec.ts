import { test, expect, registerScenario } from "../../fixtures/index.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});

test("create team", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/create");
  await page.getByLabel(/name/i).fill("Beta");
  await page.getByLabel(/^key$/i).fill("BET");
  await page.getByRole("button", { name: /create team/i }).click();

  await expect(page).toHaveURL(/\/settings\/teams$/);
  await expect(page.getByText("Beta")).toBeVisible();
});

test("duplicate team key is rejected", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/create");
  await page.getByLabel(/name/i).fill("Duplicate");
  await page.getByLabel(/^key$/i).fill("TES");
  await page.getByRole("button", { name: /create team/i }).click();

  await expect(page).toHaveURL(/\/teams\/create/);
  await expect(page.getByText("Team key already exists in this workspace")).toBeVisible();
});

test("required fields enforced", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/create");
  await page.getByRole("button", { name: /create team/i }).click();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
});
