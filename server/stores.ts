import { and, asc, eq } from "drizzle-orm";
import { defaultLayout, parseLayout, type StoreSection } from "../src/shared/stores";
import { db } from "./db";
import { stores } from "./db/schema";

const toStore = (row: typeof stores.$inferSelect) => ({
  id: row.id,
  name: row.name,
  layout: parseLayout(row.layout),
});

export const listStores = (userId: string) =>
  db
    .select()
    .from(stores)
    .where(eq(stores.userId, userId))
    .orderBy(asc(stores.name))
    .all()
    .map(toStore);

export const createStore = (userId: string, name: string) => {
  const now = new Date();
  const id = crypto.randomUUID();
  db.insert(stores)
    .values({
      id,
      userId,
      name,
      layout: JSON.stringify(defaultLayout()),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
};

const mine = (userId: string, id: string) =>
  and(eq(stores.id, id), eq(stores.userId, userId));

export const updateStore = (
  userId: string,
  id: string,
  patch: { name?: string; layout?: StoreSection[] }
) => {
  if (!db.select({ id: stores.id }).from(stores).where(mine(userId, id)).get())
    return false;
  db.update(stores)
    .set({
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.layout === undefined
        ? {}
        : { layout: JSON.stringify(patch.layout) }),
      updatedAt: new Date(),
    })
    .where(mine(userId, id))
    .run();
  return true;
};

export const deleteStore = (userId: string, id: string) => {
  if (!db.select({ id: stores.id }).from(stores).where(mine(userId, id)).get())
    return false;
  db.delete(stores).where(mine(userId, id)).run();
  return true;
};
