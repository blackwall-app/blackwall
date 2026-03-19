import { test, expect, getScenarioManifest, registerScenario } from "../fixtures/index.ts";
import type { Page as PWPage } from "@playwright/test";
import type { E2EManifest } from "../scenarios/types.ts";

registerScenario(__filename, {
  scenario: "search-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

async function openSearch(page: PWPage) {
  await page.getByTestId("global-search-trigger").click();
  await expect(page.getByRole("combobox", { name: /search/i })).toBeVisible();
}

test("search by issue title returns result", async ({ page }) => {
  await page.goto("/e2e-workspace");

  await openSearch(page);
  await page.getByRole("combobox", { name: /search/i }).fill("playwright-unique-title");

  await expect(page.getByText("playwright-unique-title-xyz")).toBeVisible();
});

test("search by description keyword returns result", async ({ page }) => {
  await page.goto("/e2e-workspace");

  await openSearch(page);
  await page.getByRole("combobox", { name: /search/i }).fill("searchable-keyword-abc");

  await expect(page.getByText("playwright-unique-title-xyz")).toBeVisible();
});

test("empty search shows no error", async ({ page }) => {
  await page.goto("/e2e-workspace");

  await openSearch(page);
  await expect(page.getByRole("combobox", { name: /search/i })).toBeVisible();
  await expect(page.getByText(/error/i)).not.toBeVisible();
});

test("click result navigates to issue", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace");

  await openSearch(page);
  await page.getByRole("combobox", { name: /search/i }).fill("playwright-unique-title");
  await page.getByText("playwright-unique-title-xyz").click();

  await expect(page).toHaveURL(new RegExp(`/issue/${manifest.issues.primary.key}`));
});
