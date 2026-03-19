import { test, expect, registerScenario } from "../../fixtures/index.ts";

registerScenario(__filename, {
  scenario: "my-issues-basic",
  authUserRole: "primary",
});

test("My Issues shows issues assigned to current user", async ({ page }) => {
  await page.goto("/e2e-workspace/my-issues");
  await expect(page.getByText("My Assigned Issue")).toBeVisible();
});

test("My Issues excludes issues assigned to others", async ({ page }) => {
  await page.goto("/e2e-workspace/my-issues");
  await expect(page.getByText("Others Assigned Issue")).not.toBeVisible();
});

test("My Issues excludes unassigned issues", async ({ page }) => {
  await page.goto("/e2e-workspace/my-issues");
  await expect(page.getByText("Unassigned Issue")).not.toBeVisible();
});
