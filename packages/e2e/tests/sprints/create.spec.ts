import { test, expect, registerScenario } from "../../fixtures/index.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});

test("create sprint with all fields", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/sprints/create");
  await page.getByLabel(/^name$/i).fill("Sprint 1");
  await page.getByLabel(/goal/i).fill("Ship it");
  await page.getByRole("button", { name: /create sprint/i }).click();

  await page.waitForURL(/\/issues\/board/);
  await expect(page.getByText("Sprint 1")).toBeVisible();
});

test("create sprint with name only", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/sprints/create");
  await page.getByLabel(/^name$/i).fill("Sprint 2");
  await page.getByRole("button", { name: /create sprint/i }).click();

  await page.waitForURL(/\/issues\/board/);
  await expect(page.getByText("Sprint 2")).toBeVisible();
});

test("name is required", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/sprints/create");
  await page.getByRole("button", { name: /create sprint/i }).click();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
});
