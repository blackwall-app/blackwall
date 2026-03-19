import { test, expect, registerScenario } from "../../fixtures/index.ts";
import { E2E_DEFAULTS } from "../../helpers/defaults.ts";

registerScenario(__filename, {
  scenario: "auth-base",
  authUserRole: "primary",
});
test("view members list shows current user", async ({ page }) => {
  await page.goto("/e2e-workspace/members");
  const memberLink = page
    .getByTestId("workspace-members-list")
    .getByRole("link", { name: new RegExp(E2E_DEFAULTS.users.primary.email) })
    .first();
  await expect(memberLink).toBeVisible();
});

test("invite member creates pending invitation", async ({ page }) => {
  const invitedEmail = "invited@test.com";

  await page.goto("/e2e-workspace/members");
  await page.getByTestId("workspace-members-invite-trigger").click();
  const dialog = page.getByRole("alertdialog", { name: /invite user/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/email address/i).fill(invitedEmail);
  const submit = dialog.getByTestId("invite-dialog-submit");
  await expect(submit).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/invitations") && res.request().method() === "POST" && res.ok(),
    ),
    submit.click(),
  ]);
  await expect(dialog).not.toBeVisible();

  const payload = (await response.json()) as {
    invitation: { email: string; token: string };
    invitationUrl: string;
  };

  expect(payload.invitation.email).toBe(invitedEmail);
  expect(payload.invitation.token.length).toBeGreaterThan(0);
  expect(payload.invitationUrl).toContain(`/invite/${payload.invitation.token}`);
});

test("view member profile page", async ({ page }) => {
  await page.goto("/e2e-workspace/members");
  await page
    .getByTestId("workspace-members-list")
    .getByRole("link", { name: new RegExp(E2E_DEFAULTS.users.primary.email) })
    .first()
    .click();

  await expect(page).toHaveURL(/\/members\//);
  await expect(page.getByRole("heading", { name: E2E_DEFAULTS.users.primary.name })).toBeVisible();
});
