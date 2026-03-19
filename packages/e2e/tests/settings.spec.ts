import { test, expect, registerScenario } from "../fixtures/index.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});

test("update profile name", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/profile");

  const nameInput = page.getByLabel(/display name/i);
  await nameInput.fill("Updated Name");
  await nameInput.blur();

  await expect(page.getByText(/name updated/i)).toBeVisible();
  await expect(nameInput).toHaveValue("Updated Name");
});

test("switch to dark theme and persist", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/general");

  await page
    .getByRole("button", { name: /system|light|dark/i })
    .first()
    .click();
  await page.getByRole("option", { name: /dark/i }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("switch to light theme and persist", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/general");

  await page
    .getByRole("button", { name: /system|light|dark/i })
    .first()
    .click();
  await page.getByRole("option", { name: /light/i }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
