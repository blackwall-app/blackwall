import { test, expect, getScenarioManifest, registerScenario } from "../fixtures/index.ts";
import type { Page as PWPage } from "@playwright/test";
import type { E2EManifest } from "../scenarios/types.ts";
import { createAuthedApiContext } from "../helpers/scenario.ts";

registerScenario(__filename, {
  scenario: "labels-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

async function openLabelsPicker(page: PWPage) {
  await page.getByTestId("issue-labels-picker-trigger").click();
  await expect(page.getByTestId("picker-search-input").last()).toBeVisible();
}

function issueLabelBadge(page: PWPage, labelName: string) {
  return page.getByTestId("issue-label-badge").filter({ hasText: labelName });
}

async function toggleLabel(page: PWPage, labelName: string) {
  await openLabelsPicker(page);
  await page.getByRole("option", { name: labelName, exact: true }).click();
  await page.keyboard.press("Escape");
}

test("create label", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);

  await openLabelsPicker(page);
  await page.getByTestId("picker-search-input").last().fill("Bug");
  await page.keyboard.press("Enter");

  await expect(issueLabelBadge(page, "Bug")).toBeVisible();
});

test("add label to issue", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);
  await toggleLabel(page, "Feature");

  await expect(issueLabelBadge(page, "Feature")).toBeVisible();
});

test("remove label from issue", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);
  await toggleLabel(page, "Remove Me");
  await expect(issueLabelBadge(page, "Remove Me")).toBeVisible();

  await toggleLabel(page, "Remove Me");
  await expect(issueLabelBadge(page, "Remove Me")).toHaveCount(0);
});

test("delete label removes it from workspace", async ({ page }) => {
  const manifest = getManifest();
  await page.goto(`/e2e-workspace/issue/${manifest.issues.primary.key}`);
  await openLabelsPicker(page);
  await page.getByTestId("picker-search-input").last().fill("DeleteLabel");
  await expect(page.getByRole("option", { name: "DeleteLabel", exact: true })).toHaveCount(1);
  await page.keyboard.press("Escape");

  const apiContext = await createAuthedApiContext(manifest.users.primary);
  const listResponse = await apiContext.get("/api/labels", {
    headers: { "x-blackwall-workspace-slug": manifest.workspaceSlug },
  });
  expect(listResponse.ok()).toBeTruthy();
  const listPayload = (await listResponse.json()) as {
    labels: Array<{ id: string; name: string }>;
  };
  const label = listPayload.labels.find((item) => item.name === "DeleteLabel");
  expect(label).toBeDefined();

  const deleteResponse = await apiContext.delete(`/api/labels/${label!.id}`, {
    headers: { "x-blackwall-workspace-slug": manifest.workspaceSlug },
  });
  expect(deleteResponse.ok()).toBeTruthy();
  await apiContext.dispose();

  await page.reload();
  await openLabelsPicker(page);
  await page.getByTestId("picker-search-input").last().fill("DeleteLabel");
  await expect(page.getByRole("option", { name: "DeleteLabel", exact: true })).toHaveCount(0);
});
