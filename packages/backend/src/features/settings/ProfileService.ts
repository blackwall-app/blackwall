import { Database } from "@blackwall/database/effect";
import type { User } from "@blackwall/database/schema";
import {
  AVATAR_MAX_BYTES,
  AvatarFileMissing,
  AvatarNotAnImage,
  AvatarTooLarge,
  PasswordChangeFailed,
  ProfileNotFound,
  type PreferredLocale,
  type PreferredTheme,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { Auth } from "../auth/Auth";
import { profileData } from "./profile.data";

export interface AvatarUpload {
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

export class ProfileService extends Context.Service<
  ProfileService,
  {
    readonly getProfile: (userId: string) => Effect.Effect<User, ProfileNotFound>;
    readonly updateName: (input: {
      userId: string;
      name: string;
    }) => Effect.Effect<User, ProfileNotFound>;
    /** Stores the image as a data URL in `user.image`. */
    readonly setAvatar: (input: {
      userId: string;
      file: AvatarUpload | undefined;
    }) => Effect.Effect<
      User,
      ProfileNotFound | AvatarFileMissing | AvatarNotAnImage | AvatarTooLarge
    >;
    readonly removeAvatar: (input: { userId: string }) => Effect.Effect<User, ProfileNotFound>;
    readonly updatePreferredTheme: (input: {
      userId: string;
      theme: PreferredTheme;
    }) => Effect.Effect<User, ProfileNotFound>;
    readonly updatePreferredLocale: (input: {
      userId: string;
      locale: PreferredLocale | null;
    }) => Effect.Effect<User, ProfileNotFound>;
    /** Checks the current password against the session in `headers`. */
    readonly changePassword: (input: {
      headers: globalThis.Headers | Record<string, string>;
      currentPassword: string;
      newPassword: string;
      revokeOtherSessions: boolean;
    }) => Effect.Effect<void, PasswordChangeFailed>;
  }
>()("blackwall/ProfileService") {
  static readonly layer = Layer.effect(
    ProfileService,
    Effect.gen(function* () {
      const database = yield* Database;
      const auth = yield* Auth;

      const getProfile = Effect.fn("ProfileService.getProfile")(
        function* (userId: string) {
          const user = yield* database.use((db) => profileData.getUserById(userId, db));
          if (user === undefined) {
            return yield* new ProfileNotFound();
          }
          return user;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const updateUser = Effect.fn("ProfileService.updateUser")(
        function* (input: Parameters<typeof profileData.updateUser>[0]) {
          const user = yield* database.use((db) => profileData.updateUser(input, db));
          if (user === undefined) {
            return yield* new ProfileNotFound();
          }
          return user;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const updateName = Effect.fn("ProfileService.updateName")(function* (input: {
        userId: string;
        name: string;
      }) {
        return yield* updateUser({ userId: input.userId, changes: { name: input.name } });
      });

      const setAvatar = Effect.fn("ProfileService.setAvatar")(function* (input: {
        userId: string;
        file: AvatarUpload | undefined;
      }) {
        const { file } = input;
        if (file === undefined || file.bytes.length === 0) {
          return yield* new AvatarFileMissing();
        }
        if (!file.contentType.startsWith("image/")) {
          return yield* new AvatarNotAnImage();
        }
        if (file.bytes.length > AVATAR_MAX_BYTES) {
          return yield* new AvatarTooLarge();
        }
        const image = `data:${file.contentType};base64,${Buffer.from(file.bytes).toString("base64")}`;
        return yield* updateUser({ userId: input.userId, changes: { image } });
      });

      const removeAvatar = Effect.fn("ProfileService.removeAvatar")(function* (input: {
        userId: string;
      }) {
        return yield* updateUser({ userId: input.userId, changes: { image: null } });
      });

      const updatePreferredTheme = Effect.fn("ProfileService.updatePreferredTheme")(
        function* (input: { userId: string; theme: PreferredTheme }) {
          return yield* updateUser({
            userId: input.userId,
            changes: { preferredTheme: input.theme },
          });
        },
      );

      const updatePreferredLocale = Effect.fn("ProfileService.updatePreferredLocale")(
        function* (input: { userId: string; locale: PreferredLocale | null }) {
          return yield* updateUser({
            userId: input.userId,
            changes: { preferredLocale: input.locale },
          });
        },
      );

      const changePassword = Effect.fn("ProfileService.changePassword")(
        function* (input: {
          headers: globalThis.Headers | Record<string, string>;
          currentPassword: string;
          newPassword: string;
          revokeOtherSessions: boolean;
        }) {
          yield* auth.changePassword(input);
        },
        Effect.catchTag("AuthError", () => Effect.fail(new PasswordChangeFailed())),
      );

      return ProfileService.of({
        getProfile,
        updateName,
        setAvatar,
        removeAvatar,
        updatePreferredTheme,
        updatePreferredLocale,
        changePassword,
      });
    }),
  );
}
