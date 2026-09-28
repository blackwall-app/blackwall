import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { runApi } from "../../test/api";
import { createWorkspace, seedTestSetup } from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";
import { env } from "../../lib/env";
import { handleApiRequest } from "../index";

// The typed client validates payloads, hides headers, and only sends the cookie
// to endpoints behind `Authorization`, so some cases use raw requests.
const invitationsUrl = `${env.APP_BASE_URL}/api/invitations`;

const getWithCookie = (token: string, cookie: string) =>
  handleApiRequest(new Request(`${invitationsUrl}/${token}`, { headers: { cookie } }));

const postRegister = (token: string, body: unknown) =>
  handleApiRequest(
    new Request(`${invitationsUrl}/${token}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("invitations api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const invite = (email: string) =>
    runApi(authed(), (client) => client.invitations.create({ payload: { email } }));

  /** Signs up a user with a workspace of their own and returns their session cookie. */
  const signUp = async (email: string) => {
    const response = await handleApiRequest(
      new Request(`${env.APP_BASE_URL}/api/auth/signup/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
          name: "Other User",
          workspaceDisplayName: "Other Workspace",
          workspaceUrlSlug: "other-workspace",
        }),
      }),
    );
    return response.headers.get("set-cookie")!;
  };

  const storedInvitation = (id: string) =>
    testDb.db.query.workspaceInvitation.findFirst({ where: { id } });

  describe("create", () => {
    test("rejects requests without a session", async () => {
      const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
        Effect.flip(client.invitations.create({ payload: { email: "new@example.com" } })),
      );
      expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
    });

    test("requires a workspace the user belongs to", async () => {
      await createWorkspace(testDb, { slug: "private", displayName: "Private" });

      const missing = await runApi({ cookie: seed.cookie }, (client) =>
        Effect.flip(client.invitations.create({ payload: { email: "new@example.com" } })),
      );
      const forbidden = await runApi({ cookie: seed.cookie, workspaceSlug: "private" }, (client) =>
        Effect.flip(client.invitations.create({ payload: { email: "new@example.com" } })),
      );

      expect(missing).toMatchObject({ code: "MISSING_WORKSPACE_HEADER" });
      expect(forbidden).toMatchObject({ code: "NOT_WORKSPACE_MEMBER" });
    });

    test("stores a hashed token and queues the invite email", async () => {
      const response = await invite("newuser@example.com");

      expect(response.message).toBe("Invitation sent successfully.");
      expect(response.invitation).toMatchObject({
        email: "newuser@example.com",
        workspaceId: seed.workspace.id,
        createdById: seed.user.id,
        acceptedAt: null,
      });
      expect(response.invitationUrl).toBe(
        `${env.APP_BASE_URL}/invite/${response.invitation.token}`,
      );
      const stored = await storedInvitation(response.invitation.id);
      expect(stored?.tokenHash).not.toBe(response.invitation.token);

      const jobs = await testDb.db
        .select()
        .from(dbSchema.job)
        .where(eq(dbSchema.job.type, "invite-email"));
      expect(jobs.map((job) => JSON.parse(job.payload))).toEqual([
        {
          email: "newuser@example.com",
          workspaceName: seed.workspace.displayName,
          inviterName: seed.user.name,
          invitationUrl: response.invitationUrl,
        },
      ]);
    });

    test("rejects an invalid email with a coded 400", async () => {
      const response = await handleApiRequest(
        new Request(invitationsUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: seed.cookie,
            "x-blackwall-workspace-slug": seed.workspace.slug,
          },
          body: JSON.stringify({ email: "not-an-email" }),
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("get", () => {
    test("shows the invitation to anonymous visitors", async () => {
      const { invitation } = await invite("invitee@example.com");

      const details = await runApi({}, (client) =>
        client.invitations.get({ params: { token: invitation.token } }),
      );

      expect(details.invitation).toEqual({
        email: "invitee@example.com",
        isMember: false,
        workspace: { displayName: seed.workspace.displayName, slug: seed.workspace.slug },
      });
    });

    test("tells a signed-in visitor whether they already belong to the workspace", async () => {
      const { invitation } = await invite("other@example.com");
      const otherCookie = await signUp("other@example.com");

      const member = await getWithCookie(invitation.token, seed.cookie);
      const outsider = await getWithCookie(invitation.token, otherCookie);

      expect(await member.json()).toMatchObject({ invitation: { isMember: true } });
      expect(await outsider.json()).toMatchObject({ invitation: { isMember: false } });
    });

    test("rejects unknown, expired, and used tokens", async () => {
      const expired = await invite("expired@example.com");
      await testDb.db
        .update(dbSchema.workspaceInvitation)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(dbSchema.workspaceInvitation.id, expired.invitation.id));
      const used = await invite("test@example.com");
      await runApi({ cookie: seed.cookie }, (client) =>
        client.invitations.accept({ params: { token: used.invitation.token } }),
      );

      for (const token of ["invalid-token", expired.invitation.token, used.invitation.token]) {
        const error = await runApi({}, (client) =>
          Effect.flip(client.invitations.get({ params: { token } })),
        );
        expect(error).toMatchObject({
          _tag: "InvitationNotFoundOrExpired",
          code: "INVITATION_NOT_FOUND_OR_EXPIRED",
        });
      }
    });
  });

  describe("accept", () => {
    test("rejects requests without a session", async () => {
      const { invitation } = await invite("invitee@example.com");

      const error = await runApi({}, (client) =>
        Effect.flip(client.invitations.accept({ params: { token: invitation.token } })),
      );

      expect(error).toMatchObject({ _tag: "Unauthorized" });
    });

    test("adds the user to the workspace and uses up the invitation", async () => {
      const { invitation } = await invite("Accepter@example.com");
      const cookie = await signUp("accepter@example.com");

      const response = await runApi({ cookie }, (client) =>
        client.invitations.accept({ params: { token: invitation.token } }),
      );

      expect(response).toEqual({
        message: "Invitation accepted successfully.",
        workspaceSlug: seed.workspace.slug,
      });
      const { workspaces } = await runApi({ cookie }, (client) => client.workspaces.list());
      expect(workspaces.map((workspace) => workspace.slug)).toContain(seed.workspace.slug);
      const stored = await storedInvitation(invitation.id);
      expect(stored?.acceptedAt).not.toBeNull();
      expect(stored?.acceptedById).not.toBeNull();

      const reuse = await runApi({ cookie }, (client) =>
        Effect.flip(client.invitations.accept({ params: { token: invitation.token } })),
      );
      expect(reuse).toMatchObject({ code: "INVITATION_NOT_FOUND_OR_EXPIRED" });
    });

    test("accepts an invitation for an existing member without adding them twice", async () => {
      const { invitation } = await invite("test@example.com");

      await runApi({ cookie: seed.cookie }, (client) =>
        client.invitations.accept({ params: { token: invitation.token } }),
      );

      const memberships = await testDb.db.query.workspaceUser.findMany({
        where: { userId: seed.user.id, workspaceId: seed.workspace.id },
      });
      expect(memberships).toHaveLength(1);
      expect((await storedInvitation(invitation.id))?.acceptedById).toBe(seed.user.id);
    });

    test("rejects a user with a different email address", async () => {
      const { invitation } = await invite("someone-else@example.com");

      const error = await runApi({ cookie: seed.cookie }, (client) =>
        Effect.flip(client.invitations.accept({ params: { token: invitation.token } })),
      );

      expect(error).toMatchObject({ _tag: "InvitationEmailMismatch", code: "FORBIDDEN" });
      expect((await storedInvitation(invitation.id))?.acceptedAt).toBeNull();
    });
  });

  describe("register", () => {
    test("signs up the invitee, adds them to the workspace, and sets a session cookie", async () => {
      const { invitation } = await invite("newregistrant@example.com");

      const response = await postRegister(invitation.token, {
        name: "New Registrant",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        user: { email: "newregistrant@example.com", name: "New Registrant" },
        workspaceSlug: seed.workspace.slug,
      });
      const cookie = response.headers.get("set-cookie");
      expect(cookie).toContain("better-auth.session_token=");
      const { workspaces } = await runApi({ cookie: cookie! }, (client) =>
        client.workspaces.list(),
      );
      expect(workspaces.map((workspace) => workspace.slug)).toEqual([seed.workspace.slug]);
      expect((await storedInvitation(invitation.id))?.acceptedAt).not.toBeNull();
    });

    test("rejects an unknown token", async () => {
      const error = await runApi({}, (client) =>
        Effect.flip(
          client.invitations.register({
            params: { token: "invalid-token" },
            payload: { name: "Test User", password: "password123" },
          }),
        ),
      );

      expect(error).toMatchObject({ code: "INVITATION_NOT_FOUND_OR_EXPIRED" });
    });

    test("rejects an email that already has an account", async () => {
      const { invitation } = await invite("test@example.com");

      const error = await runApi({}, (client) =>
        Effect.flip(
          client.invitations.register({
            params: { token: invitation.token },
            payload: { name: "Test User", password: "password123" },
          }),
        ),
      );

      expect(error).toMatchObject({ _tag: "UserAlreadyExists", code: "USER_ALREADY_EXISTS" });
      expect((await storedInvitation(invitation.id))?.acceptedAt).toBeNull();
    });

    test("rejects a short name with a coded 400", async () => {
      const { invitation } = await invite("shortname@example.com");

      const response = await postRegister(invitation.token, { name: "A", password: "password123" });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });
});
