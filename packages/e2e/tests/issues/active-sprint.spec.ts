import { test, expect, getScenarioManifest, registerScenario } from "../../fixtures/index.ts";
import type { E2EManifest } from "../../scenarios/types.ts";
import { createAuthedApiContext } from "../../helpers/scenario.ts";

registerScenario(__filename, {
  scenario: "active-sprint-basic",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

function emptyDoc() {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

test("empty state shown with no active issues", async ({ page }) => {
  await page.goto("/e2e-workspace/team/TES/issues/active");
  await expect(page.getByText("No active issues", { exact: true })).toBeVisible();
});

test("active issues page shows to do and in progress issues", async ({ page }) => {
  const manifest = getManifest();
  const apiContext = await createAuthedApiContext(manifest.users.primary);

  await apiContext.post("/api/issues", {
    headers: { "x-blackwall-workspace-slug": manifest.workspaceSlug },
    data: {
      teamKey: manifest.teamKey,
      issue: {
        summary: "Active To Do",
        description: emptyDoc(),
        status: "to_do",
      },
    },
  });
  await apiContext.post("/api/issues", {
    headers: { "x-blackwall-workspace-slug": manifest.workspaceSlug },
    data: {
      teamKey: manifest.teamKey,
      issue: {
        summary: "Active In Progress",
        description: emptyDoc(),
        status: "in_progress",
      },
    },
  });
  await apiContext.dispose();

  await page.goto("/e2e-workspace/team/TES/issues/active");

  await expect(page.getByText("Active To Do")).toBeVisible();
  await expect(page.getByText("Active In Progress")).toBeVisible();
  await expect(page.getByText("Done Issue")).not.toBeVisible();
});
