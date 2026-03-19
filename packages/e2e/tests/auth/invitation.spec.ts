import { test, expect, type Page } from "@playwright/test";
import type { E2EManifest } from "../../scenarios/types.ts";
import {
  createAuthedApiContext,
  createAuthedBrowserContext,
  prepareScenario,
} from "../../helpers/scenario.ts";

let manifest: E2EManifest;

test.beforeAll(async () => {
  manifest = await prepareScenario("invitation-base");
});

async function createInvitation(email: string) {
  const apiContext = await createAuthedApiContext(manifest.users.primary);
  const response = await apiContext.post("/api/invitations", {
    headers: { "x-blackwall-workspace-slug": manifest.workspaceSlug },
    data: { email },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    invitation: { token: string; email: string };
    invitationUrl: string;
  };
  await apiContext.dispose();
  return payload;
}

test("invitation page shows workspace name and register form", async ({ page }) => {
  const invitation = await createInvitation("context@test.com");

  await page.goto(`/invite/${invitation.invitation.token}`);

  await expect(page.getByText(/e2e workspace/i)).toBeVisible();
  await expect(page.getByLabel(/name/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /join workspace/i })).toBeVisible();
});

test("new user registers via invitation and lands on workspace", async ({ page }) => {
  const invitation = await createInvitation("newregister@test.com");

  await page.goto(`/invite/${invitation.invitation.token}`);
  await page.getByLabel(/name/i).fill("New Registrant");
  await page.getByLabel(/password/i).fill("TestPassword1!");
  await page.getByRole("button", { name: /join workspace/i }).click();

  await page.waitForURL(new RegExp(`/${manifest.workspaceSlug}`));
});

test("authenticated user with matching email sees join button and accepts", async ({ browser }) => {
  const invitation = await createInvitation(manifest.users.secondary.email);

  const context = await createAuthedBrowserContext(browser, manifest.users.secondary);
  const page = await context.newPage();

  await page.goto(`/invite/${invitation.invitation.token}`);
  await expect(page.getByRole("button", { name: /join as user b/i })).toBeVisible();
  await page.getByRole("button", { name: /join as user b/i }).click();

  await page.waitForURL(new RegExp(`/${manifest.workspaceSlug}`));
  await context.close();
});

test("authenticated user with wrong email sees wrong account message", async ({ browser }) => {
  const invitation = await createInvitation("someoneelse@test.com");

  const context = await createAuthedBrowserContext(browser, manifest.users.wrongUser);
  const page = await context.newPage();

  await page.goto(`/invite/${invitation.invitation.token}`);
  await expect(page.getByText(/wrong account/i)).toBeVisible();
  await context.close();
});

test("invitation is consumed after use and token no longer works", async ({ page }) => {
  const invitation = await createInvitation("useonce@test.com");

  await page.goto(`/invite/${invitation.invitation.token}`);
  await page.getByLabel(/name/i).fill("Use Once");
  await page.getByLabel(/password/i).fill("TestPassword1!");
  await page.getByRole("button", { name: /join workspace/i }).click();
  await page.waitForURL(new RegExp(`/${manifest.workspaceSlug}`));

  await page.goto(`/invite/${invitation.invitation.token}`);
  await expect(page.getByText(/not found|expired|invalid/i)).toBeVisible();
});

test("invalid token shows error", async ({ page }) => {
  await page.goto("/invite/not-a-real-token");
  await expect(page.getByText(/not found|expired|invalid/i)).toBeVisible();
});
