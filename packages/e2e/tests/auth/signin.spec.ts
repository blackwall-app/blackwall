import { test, expect, type Page } from "@playwright/test";
import { prepareScenario } from "../../helpers/scenario.ts";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.beforeEach(async () => {
  await prepareScenario("auth-base");
});

test("successful sign in redirects to workspace", async ({ page }) => {
  await signIn(page, "e2e@test.com", "TestPassword1!");

  await page.waitForURL(/\/e2e-workspace\//);
  await expect(page).not.toHaveURL(/\/signin/);
});

test("wrong password shows error", async ({ page }) => {
  await signIn(page, "e2e@test.com", "WrongPassword!");

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});

test("unknown email shows error", async ({ page }) => {
  await signIn(page, "nobody@test.com", "TestPassword1!");

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});

test("sign out redirects to signin and clears session", async ({ page }) => {
  await signIn(page, "e2e@test.com", "TestPassword1!");
  await page.waitForURL(/\/e2e-workspace\//);

  await page.getByTestId("user-menu-trigger").click();
  await page.getByRole("menuitem", { name: /log out/i }).click();
  await page.waitForURL(/\/signin/);

  await page.goto("/e2e-workspace");
  await expect(page).toHaveURL(/\/signin/);
});

test("unauthenticated access to protected route redirects to signin", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/e2e-workspace");
  await expect(page).toHaveURL(/\/signin/);

  await context.close();
});
