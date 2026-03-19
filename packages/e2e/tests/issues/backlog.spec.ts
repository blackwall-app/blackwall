import { test, expect, getScenarioManifest, registerScenario } from "../../fixtures/index.ts";
import type { E2EManifest } from "../../scenarios/types.ts";

registerScenario(__filename, {
  scenario: "backlog-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

test("backlog shows issues without sprint", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await expect(page.getByText("Backlog Issue One")).toBeVisible();
  await expect(page.getByText("Backlog Issue Two")).toBeVisible();
});

test("backlog excludes sprint issues", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await expect(page.getByText("Sprint Issue One")).not.toBeVisible();
});

test("navigate to issue detail from backlog", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace/team/TES/issues/backlog");
  await page
    .getByRole("link", { name: new RegExp(manifest.issues.backlogPrimary.key) })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/issue/${manifest.issues.backlogPrimary.key}`));
});

test("row selection menu appears when issue is selected", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/backlog");

  await page
    .getByLabel(/select row/i)
    .first()
    .click();
  await expect(page.getByText(/1 selected/i)).toBeVisible();
});
