import { inArray } from "drizzle-orm";
import { db, dbSchema } from "@blackwall/database";

export async function getUsersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(dbSchema.user).where(inArray(dbSchema.user.id, ids));
}

export const userData = {
  getUsersByIds,
};
