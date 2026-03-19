import { settingsData } from "./settings.data";
import { auth } from "../auth/better-auth";

/**
 * Get a user's profile by their id.
 * @param userId user id
 * @returns user profile data
 */
async function getProfile(userId: string) {
  return settingsData.getUserById(userId);
}

/**
 * Update a user's display name.
 * @param input user id and new name
 * @returns updated user profile
 * @throws Error if name is empty
 */
async function updateProfileName(input: { userId: string; name: string }) {
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Name cannot be empty");
  }

  return settingsData.updateUserName({
    userId: input.userId,
    name: normalizedName,
  });
}

/**
 * Update a user's profile avatar.
 * @param input user id, new image (or null to remove), and current image
 * @returns updated user profile
 */
async function updateProfileAvatar(input: {
  userId: string;
  image: string | null;
  currentImage: string | null;
}) {
  return settingsData.updateUserAvatar({
    userId: input.userId,
    image: input.image,
  });
}

/**
 * Change the user's password.
 * @param input request headers, current password, new password, and optional session revocation
 */
async function changePassword(input: {
  headers: Headers;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}) {
  await auth.api.changePassword({
    headers: input.headers,
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: input.revokeOtherSessions ?? false,
    },
  });
}

/**
 * Update a user's preferred theme.
 */
async function updatePreferredTheme(input: { userId: string; theme: string }) {
  return settingsData.updateUserTheme({
    userId: input.userId,
    theme: input.theme,
  });
}

/**
 * Update a user's preferred locale.
 */
async function updatePreferredLocale(input: { userId: string; locale: "en" | "pl" | null }) {
  return settingsData.updateUserLocale({
    userId: input.userId,
    locale: input.locale,
  });
}

export const settingsService = {
  getProfile,
  updateProfileName,
  updateProfileAvatar,
  changePassword,
  updatePreferredTheme,
  updatePreferredLocale,
};
