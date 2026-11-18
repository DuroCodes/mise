import { eq } from "drizzle-orm";
import { db } from "./db";
import { userSettings } from "./db/schema";

export type UserSettings = { aiEnabled: boolean };

const defaults: UserSettings = { aiEnabled: true };

export const getUserSettings = (userId: string): UserSettings => {
  const row = db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  return row ? { aiEnabled: row.aiEnabled } : { ...defaults };
};

export const updateUserSettings = (
  userId: string,
  patch: Partial<UserSettings>
) => {
  const next = { ...getUserSettings(userId), ...patch };
  db.insert(userSettings)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: userSettings.userId, set: next })
    .run();
  return next;
};
