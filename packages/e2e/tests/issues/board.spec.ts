import { test, expect, getScenarioManifest, registerScenario } from "../../fixtures/index.ts";
import type { Locator, Page } from "@playwright/test";
import type { E2EManifest } from "../../scenarios/types.ts";

registerScenario(__filename, {
  scenario: "board-active-sprint",
  authUserRole: "primary",
});

function getManifest() {
  return getScenarioManifest<E2EManifest>(__filename);
}

test.describe.configure({ timeout: 12_000 });

async function dragCardToColumn(page: Page, sourceCard: Locator, targetDropzone: Locator) {
  await sourceCard.scrollIntoViewIfNeeded();
  await targetDropzone.scrollIntoViewIfNeeded();

  const sourceBox = await sourceCard.boundingBox();
  const targetBox = await targetDropzone.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Could not calculate drag coordinates for board card");
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + Math.min(targetBox.height / 2, 160);

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.move(sourceX + 12, sourceY + 12, { steps: 4 });
  await page.mouse.move(targetX, targetY, { steps: 16 });
  await page.mouse.up();
}

test("board loads with correct columns", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace/team/TES/issues/board");

  await expect(page.getByTestId("board-column-to_do")).toBeVisible();
  await expect(page.getByTestId("board-column-in_progress")).toBeVisible();
  await expect(page.getByTestId("board-column-done")).toBeVisible();

  await expect(page.getByTestId(`board-card-${manifest.issues.toDo.key}`)).toBeVisible();
  await expect(page.getByTestId(`board-card-${manifest.issues.inProgress.key}`)).toBeVisible();
  await expect(page.getByTestId(`board-card-${manifest.issues.done.key}`)).toBeVisible();
});

test("drag issue from To Do to In Progress", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace/team/TES/issues/board");

  const sourceCard = page.getByTestId(`board-card-${manifest.issues.toDo.key}`);
  const targetColumn = page.getByTestId("board-column-in_progress");
  const targetDropzone = page.getByTestId("board-column-dropzone-in_progress");

  await dragCardToColumn(page, sourceCard, targetDropzone);

  await expect(targetColumn.getByTestId(`board-card-${manifest.issues.toDo.key}`)).toBeVisible({
    timeout: 8_000,
  });
});

test("drag issue from In Progress to Done", async ({ page }) => {
  const manifest = getManifest();
  await page.goto("/e2e-workspace/team/TES/issues/board");

  const sourceCard = page.getByTestId(`board-card-${manifest.issues.inProgress.key}`);
  const targetColumn = page.getByTestId("board-column-done");
  const targetDropzone = page.getByTestId("board-column-dropzone-done");

  await dragCardToColumn(page, sourceCard, targetDropzone);

  await expect(
    targetColumn.getByTestId(`board-card-${manifest.issues.inProgress.key}`),
  ).toBeVisible({
    timeout: 8_000,
  });
});
