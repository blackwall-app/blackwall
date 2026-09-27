import { dbSchema, type DbHandle } from "@blackwall/database";
import type { NewUser } from "@blackwall/database/schema";
import { eq } from "drizzle-orm";

export async function getUserById(userId: string, handle: DbHandle) {
  return handle.query.user.findFirst({
    where: {
      id: userId,
    },
  });
}

export async function updateUser(
  input: {
    userId: string;
    changes: Partial<Pick<NewUser, "name" | "image" | "preferredTheme" | "preferredLocale">>;
  },
  handle: DbHandle,
) {
  const [user] = await handle
    .update(dbSchema.user)
    .set({ ...input.changes, updatedAt: new Date() })
    .where(eq(dbSchema.user.id, input.userId))
    .returning();

  return user;
}

export const profileData = {
  getUserById,
  updateUser,
};
