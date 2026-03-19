import { test, expect, registerScenario } from "../../fixtures/index.ts";
import { E2E_DEFAULTS } from "../../helpers/defaults.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});
test("view team members", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/TES");
  await expect(page.getByText(E2E_DEFAULTS.users.primary.name)).toBeVisible();
});

test("update team name", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/TES");
  const nameInput = page.getByLabel(/^name$/i);
  await nameInput.fill("Renamed Testers");
  await nameInput.blur();

  await expect(page.getByText(/team name updated/i)).toBeVisible();
  await expect(nameInput).toHaveValue("Renamed Testers");
});

test("update team key updates route", async ({ page }) => {
  await page.goto("/e2e-workspace/settings/teams/TES");

  const keyInput = page.getByLabel(/^key$/i);
  await keyInput.fill("DEV");
  await keyInput.blur();

  await expect(page).toHaveURL(/\/settings\/teams\/DEV$/);
  await expect(page.getByText(/team key updated/i)).toBeVisible();
});
