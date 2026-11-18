import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { canView, db } from "./db";
import { mealPlan, recipes } from "./db/schema";

export const slots = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Slot = (typeof slots)[number];

const slotOrder = (slot: string) => {
  const index = slots.indexOf(slot as Slot);
  return index < 0 ? slots.length : index;
};

export const listPlan = (
  userId: string,
  from: string,
  to: string,
  asAdmin: boolean
) =>
  db
    .select({
      id: mealPlan.id,
      day: mealPlan.day,
      slot: mealPlan.slot,
      position: mealPlan.position,
      servings: mealPlan.servings,
      recipeId: recipes.id,
      title: recipes.title,
      image: recipes.image,
      recipeServings: recipes.servings,
      prepMinutes: recipes.prepMinutes,
      cookMinutes: recipes.cookMinutes,
      ownerId: recipes.ownerId,
      visibility: recipes.visibility,
    })
    .from(mealPlan)
    .innerJoin(recipes, eq(recipes.id, mealPlan.recipeId))
    .where(
      and(
        eq(mealPlan.userId, userId),
        gte(mealPlan.day, from),
        lte(mealPlan.day, to)
      )
    )
    .orderBy(asc(mealPlan.day), asc(mealPlan.position))
    .all()
    .filter((row) => asAdmin || canView(row, userId))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        slotOrder(a.slot) - slotOrder(b.slot) ||
        a.position - b.position
    )
    .map(({ ownerId: _owner, visibility: _visibility, ...row }) => row);

const nextPosition = (userId: string, day: string, slot: string) => {
  const row = db
    .select({ max: sql<number | null>`max(${mealPlan.position})` })
    .from(mealPlan)
    .where(
      and(
        eq(mealPlan.userId, userId),
        eq(mealPlan.day, day),
        eq(mealPlan.slot, slot)
      )
    )
    .get();
  return Number(row?.max ?? -1) + 1;
};

export const addPlan = (
  userId: string,
  entry: { day: string; slot: Slot; recipeId: string; servings: number | null }
) => {
  const id = crypto.randomUUID();
  db.insert(mealPlan)
    .values({
      id,
      userId,
      day: entry.day,
      slot: entry.slot,
      position: nextPosition(userId, entry.day, entry.slot),
      recipeId: entry.recipeId,
      servings: entry.servings,
      createdAt: new Date(),
    })
    .run();
  return id;
};

export const updatePlan = (
  userId: string,
  id: string,
  patch: { day?: string; slot?: Slot; servings?: number | null }
) => {
  const row = db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.id, id), eq(mealPlan.userId, userId)))
    .get();
  if (!row) return false;
  const day = patch.day ?? row.day;
  const slot = patch.slot ?? row.slot;
  const moved = day !== row.day || slot !== row.slot;
  db.update(mealPlan)
    .set({
      day,
      slot,
      servings: patch.servings === undefined ? row.servings : patch.servings,
      position: moved ? nextPosition(userId, day, slot) : row.position,
    })
    .where(eq(mealPlan.id, id))
    .run();
  return true;
};

export const removePlan = (userId: string, id: string) => {
  const mine = and(eq(mealPlan.id, id), eq(mealPlan.userId, userId));
  if (!db.select({ id: mealPlan.id }).from(mealPlan).where(mine).get())
    return false;
  db.delete(mealPlan).where(mine).run();
  return true;
};
