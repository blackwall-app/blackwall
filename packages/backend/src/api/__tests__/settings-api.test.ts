import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { AVATAR_MAX_BYTES, WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { handleEffectRequest } from "../index";
import { env } from "../../lib/zod-env";
import { runApi } from "../../test/api";
import {
  addUserToTeam,
  addUserToWorkspace,
  buildUser,
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  seedTestSetup,
} from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("settings api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const storedUser = () => testDb.db.query.user.findFirst({ where: { id: seed.user.id } });

  const createWorkspaceMember = async (email: string) => {
    const user = await createUser(testDb, buildUser({ email, name: email }));
    await addUserToWorkspace(testDb, { userId: user.id, workspaceId: seed.workspace.id });
    return user;
  };

  // The typed client validates payloads before sending, so server-side
  // validation checks go through the raw handler.
  const rawJson = async (method: string, path: string, body: unknown) => {
    const response = await handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect/settings${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          cookie: seed.cookie,
          [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  // The in-memory client sends FormData without a multipart content type, so
  // avatar uploads go through the real web handler.
  const uploadAvatar = async (form: FormData) => {
    const response = await handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect/settings/profile/avatar`, {
        method: "PATCH",
        headers: { cookie: seed.cookie, [WORKSPACE_SLUG_HEADER]: seed.workspace.slug },
        body: form,
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  describe("access", () => {
    test("rejects requests without a session", async () => {
      const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
        Effect.flip(client.settings.getProfile()),
      );
      expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
    });

    test("rejects workspaces the user doesn't belong to", async () => {
      await createWorkspace(testDb, { slug: "private", displayName: "Private" });

      const error = await runApi({ cookie: seed.cookie, workspaceSlug: "private" }, (client) =>
        Effect.flip(client.settings.listTeams()),
      );

      expect(error).toMatchObject({ _tag: "NotWorkspaceMember", code: "NOT_WORKSPACE_MEMBER" });
    });
  });

  describe("profile", () => {
    test("GET /profile returns the user with their preferences", async () => {
      const { profile } = await runApi(authed(), (client) => client.settings.getProfile());

      expect(profile).toMatchObject({
        id: seed.user.id,
        email: seed.user.email,
        preferredTheme: "system",
        preferredLocale: null,
      });
      expect(profile.createdAt).toBeInstanceOf(Date);
    });

    test("PATCH /profile trims and stores the name", async () => {
      const { profile } = await runApi(authed(), (client) =>
        client.settings.updateProfile({ payload: { name: "  Updated Name  " } }),
      );

      expect(profile.name).toBe("Updated Name");
      expect((await storedUser())?.name).toBe("Updated Name");
    });

    test("PATCH /profile rejects names that are too short once trimmed", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(client.settings.updateProfile({ payload: { name: " A " } })),
      );

      expect(error).toMatchObject({ _tag: "ValidationError", code: "VALIDATION_ERROR" });
    });

    test("PATCH /profile/theme and /profile/locale store the preferences", async () => {
      const { theme } = await runApi(authed(), (client) =>
        client.settings.updateTheme({ payload: { theme: "dark" } }),
      );
      const { locale } = await runApi(authed(), (client) =>
        client.settings.updateLocale({ payload: { locale: "pl" } }),
      );

      expect(theme).toBe("dark");
      expect(locale).toBe("pl");
      expect(await storedUser()).toMatchObject({ preferredTheme: "dark", preferredLocale: "pl" });

      await runApi(authed(), (client) =>
        client.settings.updateLocale({ payload: { locale: null } }),
      );
      expect((await storedUser())?.preferredLocale).toBeNull();
    });
  });

  describe("PATCH /profile/avatar", () => {
    const imageForm = (type: string, size: number) => {
      const form = new FormData();
      form.append("intent", "upload-file");
      form.append("file", new File([new Uint8Array(size).fill(1)], "avatar", { type }));
      return form;
    };

    test("stores the image as a data URL", async () => {
      const { status, body } = await uploadAvatar(imageForm("image/png", 3));

      expect(status).toBe(200);
      expect(body.profile.image).toBe("data:image/png;base64,AQEB");
      expect((await storedUser())?.image).toBe("data:image/png;base64,AQEB");
    });

    test("removes the avatar", async () => {
      await uploadAvatar(imageForm("image/png", 3));
      const form = new FormData();
      form.append("intent", "remove");

      const { status, body } = await uploadAvatar(form);

      expect(status).toBe(200);
      expect(body.profile.image).toBeNull();
      expect((await storedUser())?.image).toBeNull();
    });

    test("requires a file", async () => {
      const form = new FormData();
      form.append("intent", "upload-file");

      const { status, body } = await uploadAvatar(form);

      expect(status).toBe(400);
      expect(body).toMatchObject({ _tag: "AvatarFileMissing", code: "NO_AVATAR_FILE_PROVIDED" });
    });

    test("rejects files that aren't images", async () => {
      const { status, body } = await uploadAvatar(imageForm("application/pdf", 3));

      expect(status).toBe(400);
      expect(body).toMatchObject({ code: "ONLY_IMAGE_FILES_SUPPORTED" });
    });

    test("rejects images over the size limit", async () => {
      const { status, body } = await uploadAvatar(imageForm("image/png", AVATAR_MAX_BYTES + 1));

      expect(status).toBe(400);
      expect(body).toMatchObject({ _tag: "AvatarTooLarge", code: "IMAGE_TOO_LARGE" });
      expect((await storedUser())?.image).toBeNull();
    });
  });

  describe("POST /profile/password", () => {
    const account = () =>
      testDb.db.query.account.findFirst({
        where: { userId: seed.user.id, providerId: "credential" },
      });

    test("changes the password and keeps other sessions", async () => {
      await testDb.db.insert(dbSchema.session).values({
        userId: seed.user.id,
        token: "secondary-session-token",
        expiresAt: new Date(Date.now() + 604_800_000),
        ipAddress: "127.0.0.1",
        userAgent: "bun:test",
      });

      const { success } = await runApi(authed(), (client) =>
        client.settings.changePassword({
          payload: { currentPassword: seed.password, newPassword: "new-password-123" },
        }),
      );

      expect(success).toBe(true);
      const password = (await account())!.password!;
      expect(await Bun.password.verify("new-password-123", password)).toBe(true);
      const sessions = await testDb.db.query.session.findMany({ where: { userId: seed.user.id } });
      expect(sessions).toHaveLength(2);
    });

    test("fails with a wrong current password", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.changePassword({
            payload: { currentPassword: "wrong-password", newPassword: "new-password-123" },
          }),
        ),
      );

      expect(error).toMatchObject({
        _tag: "PasswordChangeFailed",
        code: "FAILED_TO_CHANGE_PASSWORD",
      });
      expect(await Bun.password.verify(seed.password, (await account())!.password!)).toBe(true);
    });

    test("rejects reusing the current password", async () => {
      const { status, body } = await rawJson("POST", "/profile/password", {
        currentPassword: "password123",
        newPassword: "password123",
      });

      expect(status).toBe(400);
      expect(body).toMatchObject({ _tag: "ValidationError", code: "VALIDATION_ERROR" });
    });
  });

  describe("workspace", () => {
    test("GET /workspace returns the header's workspace", async () => {
      const { workspace } = await runApi(authed(), (client) => client.settings.getWorkspace());

      expect(workspace).toMatchObject({ id: seed.workspace.id, slug: seed.workspace.slug });
    });

    test("PATCH /workspace updates the display name", async () => {
      const { workspace } = await runApi(authed(), (client) =>
        client.settings.updateWorkspace({ payload: { displayName: "Updated Workspace" } }),
      );

      expect(workspace.displayName).toBe("Updated Workspace");
    });

    test("PATCH /workspace without a name returns the workspace unchanged", async () => {
      const { workspace } = await runApi(authed(), (client) =>
        client.settings.updateWorkspace({ payload: {} }),
      );

      expect(workspace.displayName).toBe(seed.workspace.displayName);
    });

    test("PATCH /workspace rejects a display name that is too short", async () => {
      const { status, body } = await rawJson("PATCH", "/workspace", { displayName: "A" });

      expect(status).toBe(400);
      expect(body).toMatchObject({ _tag: "ValidationError", code: "VALIDATION_ERROR" });
    });
  });

  describe("teams", () => {
    test("GET /teams lists every workspace team with counts", async () => {
      await createTeam(testDb, { key: "OTH", name: "Other", workspaceId: seed.workspace.id });
      await createIssue(testDb, {
        workspaceId: seed.workspace.id,
        teamId: seed.team.id,
        createdById: seed.user.id,
      });
      const elsewhere = await createWorkspace(testDb, { slug: "else", displayName: "Else" });
      await createTeam(testDb, { key: "ELS", workspaceId: elsewhere.id });

      const { teams } = await runApi(authed(), (client) => client.settings.listTeams());

      expect(teams.map((row) => row.team.key).sort()).toEqual(["OTH", "TES"]);
      expect(teams.find((row) => row.team.key === "TES")).toMatchObject({
        usersCount: 1,
        issuesCount: 1,
      });
      expect(teams[0]?.team.createdAt).toBeInstanceOf(Date);
    });

    test("POST /teams uppercases the key and adds the creator", async () => {
      const { team } = await runApi(authed(), (client) =>
        client.settings.createTeam({ payload: { name: "Platform", key: "plat" } }),
      );

      expect(team.key).toBe("PLAT");
      const { teamMembers } = await runApi(authed(), (client) =>
        client.settings.getTeam({ params: { teamKey: "PLAT" } }),
      );
      expect(teamMembers.map((user) => user.id)).toEqual([seed.user.id]);
    });

    test("POST /teams rejects a key that is taken", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(client.settings.createTeam({ payload: { name: "Dup", key: "tes" } })),
      );

      expect(error).toMatchObject({
        _tag: "TeamKeyAlreadyExists",
        code: "TEAM_KEY_ALREADY_EXISTS",
      });
    });

    test("GET /teams/:teamKey returns the team and its members", async () => {
      const { team, teamMembers } = await runApi(authed(), (client) =>
        client.settings.getTeam({ params: { teamKey: "TES" } }),
      );

      expect(team.id).toBe(seed.team.id);
      expect(teamMembers.map((user) => user.id)).toEqual([seed.user.id]);
    });

    test("GET /teams/:teamKey doesn't see other workspaces' teams", async () => {
      const elsewhere = await createWorkspace(testDb, { slug: "else", displayName: "Else" });
      await createTeam(testDb, { key: "ELS", workspaceId: elsewhere.id });

      const error = await runApi(authed(), (client) =>
        Effect.flip(client.settings.getTeam({ params: { teamKey: "ELS" } })),
      );

      expect(error).toMatchObject({ _tag: "TeamNotFound", code: "TEAM_NOT_FOUND" });
    });

    test("PATCH /teams/:teamKey renames the team and moves issue keys", async () => {
      const issue = await createIssue(testDb, {
        workspaceId: seed.workspace.id,
        teamId: seed.team.id,
        createdById: seed.user.id,
        key: "TES-1",
        keyNumber: 1,
      });

      const { team } = await runApi(authed(), (client) =>
        client.settings.updateTeam({
          params: { teamKey: "TES" },
          payload: { name: "Renamed", key: "new" },
        }),
      );

      expect(team).toMatchObject({ name: "Renamed", key: "NEW" });
      const stored = await testDb.db.query.issue.findFirst({ where: { id: issue.id } });
      expect(stored?.key).toBe("NEW-1");
      const aliases = await testDb.db.query.teamKeyAlias.findMany({
        where: { teamId: seed.team.id },
      });
      expect(aliases.map((alias) => alias.key)).toEqual(["TES"]);
    });

    test("PATCH /teams/:teamKey rejects a key another team has", async () => {
      await createTeam(testDb, { key: "OTH", workspaceId: seed.workspace.id });

      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.updateTeam({ params: { teamKey: "TES" }, payload: { key: "OTH" } }),
        ),
      );

      expect(error).toMatchObject({ code: "TEAM_KEY_ALREADY_EXISTS" });
    });

    test("PATCH /teams/:teamKey fails for a missing team", async () => {
      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.updateTeam({ params: { teamKey: "NOPE" }, payload: { name: "X" } }),
        ),
      );

      expect(error).toMatchObject({ code: "TEAM_NOT_FOUND" });
    });

    test("GET /teams/:teamKey/available-users lists workspace members outside the team", async () => {
      const member = await createWorkspaceMember("member@example.com");
      await createUser(testDb, buildUser({ email: "outsider@example.com" }));

      const { users } = await runApi(authed(), (client) =>
        client.settings.listAvailableUsers({ params: { teamKey: "TES" } }),
      );

      expect(users.map((user) => user.id)).toEqual([member.id]);
    });

    test("POST and DELETE /teams/:teamKey/members add and remove a member", async () => {
      const member = await createWorkspaceMember("member@example.com");

      await runApi(authed(), (client) =>
        client.settings.addTeamMember({
          params: { teamKey: "TES" },
          payload: { userId: member.id },
        }),
      );
      const afterAdd = await runApi(authed(), (client) =>
        client.settings.getTeam({ params: { teamKey: "TES" } }),
      );
      expect(afterAdd.teamMembers.map((user) => user.id).sort()).toEqual(
        [member.id, seed.user.id].sort(),
      );

      const { success } = await runApi(authed(), (client) =>
        client.settings.removeTeamMember({ params: { teamKey: "TES", userId: member.id } }),
      );
      expect(success).toBe(true);
      const afterRemove = await runApi(authed(), (client) =>
        client.settings.getTeam({ params: { teamKey: "TES" } }),
      );
      expect(afterRemove.teamMembers.map((user) => user.id)).toEqual([seed.user.id]);
    });

    test("only team members can add or remove members", async () => {
      const other = await createTeam(testDb, { key: "OTH", workspaceId: seed.workspace.id });
      const member = await createWorkspaceMember("member@example.com");
      await addUserToTeam(testDb, { teamId: other.id, userId: member.id });

      const addError = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.addTeamMember({
            params: { teamKey: "OTH" },
            payload: { userId: seed.user.id },
          }),
        ),
      );
      const removeError = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.removeTeamMember({ params: { teamKey: "OTH", userId: member.id } }),
        ),
      );

      expect(addError).toMatchObject({ _tag: "NotTeamMember", code: "NOT_TEAM_MEMBER" });
      expect(removeError).toMatchObject({ _tag: "NotTeamMember", code: "NOT_TEAM_MEMBER" });
      const memberships = await testDb.db
        .select()
        .from(dbSchema.userTeam)
        .where(eq(dbSchema.userTeam.teamId, other.id));
      expect(memberships.map((row) => row.userId)).toEqual([member.id]);
    });

    test("POST /teams/:teamKey/members rejects users outside the workspace", async () => {
      const outsider = await createUser(testDb, buildUser({ email: "outsider@example.com" }));

      const error = await runApi(authed(), (client) =>
        Effect.flip(
          client.settings.addTeamMember({
            params: { teamKey: "TES" },
            payload: { userId: outsider.id },
          }),
        ),
      );

      expect(error).toMatchObject({ _tag: "MemberNotFound", code: "MEMBER_NOT_FOUND" });
    });
  });
});
