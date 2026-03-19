import "../../../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { cleanupTestDb, createTestDb, type TestDb } from "../../../../test/setup";
import { seedTestSetup } from "../../../../test/fixtures";
import { settingsService } from "../../settings.service";

describe("settingsService", () => {
  let testDb: TestDb;
  let userId: string;
  let originalPassword: string;
  let sessionCookie: string;

  beforeEach(async () => {
    testDb = await createTestDb();

    const { user, password, cookie } = await seedTestSetup(testDb);
    userId = user.id;
    originalPassword = password;
    sessionCookie = cookie.split(";")[0]!;
  });

  afterEach(() => {
    cleanupTestDb(testDb);
  });

  it("returns the current user profile", async () => {
    const profile = await settingsService.getProfile(userId);

    expect(profile?.id).toBe(userId);
    expect(profile?.email).toBe("test@example.com");
  });

  it("trims and persists the updated profile name", async () => {
    const updatedUser = await settingsService.updateProfileName({
      userId,
      name: "  Updated Name  ",
    });

    expect(updatedUser?.name).toBe("Updated Name");

    const storedUser = await testDb.db.query.user.findFirst({
      where: { id: userId },
    });
    expect(storedUser?.name).toBe("Updated Name");
  });

  it("rejects empty profile names after trimming", async () => {
    let error: unknown;

    try {
      await settingsService.updateProfileName({
        userId,
        name: "   ",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Name cannot be empty");
  });

  it("updates the profile avatar", async () => {
    const updatedUser = await settingsService.updateProfileAvatar({
      userId,
      image: "https://example.com/avatar.png",
      currentImage: null,
    });

    expect(updatedUser?.image).toBe("https://example.com/avatar.png");
  });

  it("changes the password and preserves other sessions when revokeOtherSessions is omitted", async () => {
    const [secondarySession] = await testDb.db
      .insert(dbSchema.session)
      .values({
        userId,
        token: "secondary-session-token",
        expiresAt: new Date(Date.now() + 604_800_000),
        ipAddress: "127.0.0.1",
        userAgent: "bun:test",
      })
      .returning();

    await settingsService.changePassword({
      headers: new Headers({ cookie: sessionCookie }),
      currentPassword: originalPassword,
      newPassword: "new-password-123",
    });

    const account = await testDb.db.query.account.findFirst({
      where: {
        userId,
        providerId: "credential",
      },
    });
    expect(account?.password).toBeDefined();
    expect(await Bun.password.verify("new-password-123", account!.password!)).toBe(true);
    expect(await Bun.password.verify(originalPassword, account!.password!)).toBe(false);

    const sessions = await testDb.db.query.session.findMany({
      where: { userId },
    });
    expect(sessions.map((session) => session.id)).toContain(secondarySession.id);
    expect(sessions).toHaveLength(2);
  });

  it("updates the user's preferred theme and locale", async () => {
    const themedUser = await settingsService.updatePreferredTheme({
      userId,
      theme: "dark",
    });
    const localizedUser = await settingsService.updatePreferredLocale({
      userId,
      locale: "pl",
    });

    expect(themedUser?.preferredTheme).toBe("dark");
    expect(localizedUser?.preferredLocale).toBe("pl");
  });
});
