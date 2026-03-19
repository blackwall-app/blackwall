import { test, expect, type Page } from "@playwright/test";
import { prepareScenario } from "../../helpers/scenario.ts";

async function completeAccountStep(
  page: Page,
  input: { name: string; email: string; password: string },
) {
  await page.getByLabel(/email/i).fill(input.email);
  await page.getByLabel(/password/i).fill(input.password);
  await page.getByLabel(/name/i).fill(input.name);
  await page.getByRole("button", { name: /continue/i }).click();
}

async function completeWorkspaceStep(
  page: Page,
  input: { workspaceName: string; workspaceSlug: string },
) {
  await page.getByLabel(/workspace.*name/i).fill(input.workspaceName);
  await page.getByLabel(/workspace.*url/i).fill(input.workspaceSlug);
  await page.getByRole("button", { name: /continue/i }).click();
}

async function signup(
  page: Page,
  input: {
    name: string;
    email: string;
    password: string;
    workspaceName: string;
    workspaceSlug: string;
  },
) {
  await page.goto("/signup");
  await completeAccountStep(page, input);
  await completeWorkspaceStep(page, input);
}

test.beforeEach(async () => {
  await prepareScenario("empty");
});

test("full signup flow creates workspace and authenticates user", async ({ page }) => {
  await signup(page, {
    name: "New User",
    email: "newuser@test.com",
    password: "TestPassword1!",
    workspaceName: "New Workspace",
    workspaceSlug: "new-workspace",
  });

  await page.waitForURL("**/new-workspace/**");
  await expect(page).not.toHaveURL(/\/signin/);
});

test("required fields enforced on account step", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: /continue/i }).click();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("weak password shows validation error", async ({ page }) => {
  await page.goto("/signup");

  await page.getByLabel(/email/i).fill("weak@test.com");
  await page.getByLabel(/password/i).fill("abc");
  await page.getByLabel(/name/i).fill("User");
  await expect(page.getByRole("button", { name: /continue/i })).toBeDisabled();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("workspace step requires workspace fields", async ({ page }) => {
  await page.goto("/signup");
  await completeAccountStep(page, {
    name: "Account Ready",
    email: "workspace-validation@test.com",
    password: "TestPassword1!",
  });

  await page.getByRole("button", { name: /continue/i }).click();

  const errors = page.locator("[data-invalid], [aria-invalid='true']");
  await expect(errors.first()).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("can go back from workspace step to account step", async ({ page }) => {
  await page.goto("/signup");
  await completeAccountStep(page, {
    name: "Back User",
    email: "back@test.com",
    password: "TestPassword1!",
  });

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test("authenticated user is redirected away from signup", async ({ page, browser }) => {
  await signup(page, {
    name: "First User",
    email: "first@test.com",
    password: "TestPassword1!",
    workspaceName: "First Workspace",
    workspaceSlug: "first-workspace",
  });

  await page.waitForURL("**/first-workspace/**");

  const state = await page.context().storageState();
  const context2 = await browser.newContext({ storageState: state });
  const page2 = await context2.newPage();

  await page2.goto("/signup");
  await expect(page2).not.toHaveURL(/\/signup/);

  await context2.close();
});
