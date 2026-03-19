import { test, expect, registerScenario } from "../../fixtures/index.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});

test("create additional workspace", async ({ page }) => {
  await page.goto("/create-workspace");
  await page.getByLabel("Name").fill("Second Workspace");
  await page.getByLabel("URL").fill("secondws");
  await page.getByRole("button", { name: "Create Workspace" }).click();

  await page.waitForURL("**/secondws/**");
  await expect(page).toHaveURL(/\/secondws\/my-issues/);
  await expect(page.getByRole("link", { name: "My issues" })).toHaveAttribute(
    "href",
    "/secondws/my-issues",
  );
});

test("existing slug is rejected", async ({ page }) => {
  await page.goto("/create-workspace");
  await page.getByLabel("Name").fill("Duplicate Workspace");
  await page.getByLabel("URL").fill("e2e-workspace");
  await page.getByRole("button", { name: "Create Workspace" }).click();

  await expect(page).toHaveURL(/\/create-workspace/);
});
