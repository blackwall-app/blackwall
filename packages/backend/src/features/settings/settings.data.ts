import { eq } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";

export async function getUserById(userId: string) {
  const user = await db.query.user.findFirst({
    where: {
      id: userId,
    },
  });

  return user;
}

export async function updateUserName(input: { userId: string; name: string }) {
  const [user] = await db
    .update(dbSchema.user)
    .set({
      name: input.name,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.user.id, input.userId))
    .returning();

  return user;
}

export async function updateUserAvatar(input: { userId: string; image: string | null }) {
  const [user] = await db
    .update(dbSchema.user)
    .set({
      image: input.image,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.user.id, input.userId))
    .returning();

  return user;
}

export async function updateUserTheme(input: { userId: string; theme: string }) {
  const [user] = await db
    .update(dbSchema.user)
    .set({
      preferredTheme: input.theme as "system" | "light" | "dark",
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.user.id, input.userId))
    .returning();

  return user;
}

export async function updateUserLocale(input: { userId: string; locale: "en" | "pl" | null }) {
  const [user] = await db
    .update(dbSchema.user)
    .set({
      preferredLocale: input.locale,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.user.id, input.userId))
    .returning();

  return user;
}

export const settingsData = {
  getUserById,
  updateUserName,
  updateUserAvatar,
  updateUserTheme,
  updateUserLocale,
};
