import { and, asc, eq, sql } from "drizzle-orm";
import { scaleIngredient, type Measure } from "../src/lib/units";
import type { Ingredient } from "../src/shared/recipe";
import {
  combineQuantities,
  itemKey,
  parseSources,
} from "../src/shared/shopping";
import { db } from "./db";
import { shoppingItems } from "./db/schema";

export type ShoppingLine = {
  name: string;
  amount: string;
  unit: string;
  note: string;
  source?: string;
};

const toItem = (row: typeof shoppingItems.$inferSelect) => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  unit: row.unit,
  note: row.note,
  sources: parseSources(row.sources),
  checked: row.checked,
});

export const listShopping = (userId: string) =>
  db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.userId, userId))
    .orderBy(asc(shoppingItems.checked), asc(shoppingItems.position))
    .all()
    .map(toItem);

/**
 * Adds lines to a person's list. A line joins an unchecked item with the same
 * name when the amounts can be added (same unit, or convertible units).
 */
export const mergeLines = (userId: string, lines: ShoppingLine[]) => {
  db.transaction((tx) => {
    const open = tx
      .select()
      .from(shoppingItems)
      .where(
        and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, false))
      )
      .all();
    const top = tx
      .select({ max: sql<number | null>`max(${shoppingItems.position})` })
      .from(shoppingItems)
      .where(eq(shoppingItems.userId, userId))
      .get();
    let position = Number(top?.max ?? -1) + 1;

    for (const line of lines) {
      const name = line.name.trim().slice(0, 200);
      const key = itemKey(name);
      if (!key) continue;

      let merged = false;
      for (const row of open) {
        if (itemKey(row.name) !== key) continue;
        const sum = combineQuantities(
          { amount: row.amount, unit: row.unit },
          { amount: line.amount.trim(), unit: line.unit.trim() }
        );
        if (!sum) continue;
        const sources = parseSources(row.sources);
        if (line.source && !sources.includes(line.source))
          sources.push(line.source);
        row.amount = sum.amount.slice(0, 40);
        row.unit = sum.unit.slice(0, 40);
        row.sources = JSON.stringify(sources);
        if (!row.note && line.note) row.note = line.note.slice(0, 200);
        tx.update(shoppingItems)
          .set({
            amount: row.amount,
            unit: row.unit,
            sources: row.sources,
            note: row.note,
          })
          .where(eq(shoppingItems.id, row.id))
          .run();
        merged = true;
        break;
      }
      if (merged) continue;

      const row = {
        id: crypto.randomUUID(),
        userId,
        name,
        amount: line.amount.trim().slice(0, 40),
        unit: line.unit.trim().slice(0, 40),
        note: line.note.trim().slice(0, 200),
        sources: JSON.stringify(line.source ? [line.source] : []),
        checked: false,
        position,
        createdAt: new Date(),
      };
      position += 1;
      tx.insert(shoppingItems).values(row).run();
      open.push(row);
    }
  });
};

export const recipeLines = (
  recipe: { title: string; servings: number | null; ingredients: Ingredient[] },
  servings: number | null,
  measure: Measure
): ShoppingLine[] => {
  const factor =
    recipe.servings && servings && servings > 0
      ? servings / recipe.servings
      : 1;
  return recipe.ingredients.map((item) => {
    const scaled = scaleIngredient(item, factor, measure);
    return {
      name: scaled.name,
      amount: scaled.amount,
      unit: scaled.unit,
      note: scaled.note,
      source: recipe.title,
    };
  });
};

export const updateItem = (
  userId: string,
  id: string,
  patch: Partial<{
    name: string;
    amount: string;
    unit: string;
    note: string;
    checked: boolean;
  }>
) => {
  const row = db
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.id, id), eq(shoppingItems.userId, userId)))
    .get();
  if (!row) return false;
  db.update(shoppingItems).set(patch).where(eq(shoppingItems.id, id)).run();
  return true;
};

export const removeItem = (userId: string, id: string) => {
  const mine = and(eq(shoppingItems.id, id), eq(shoppingItems.userId, userId));
  if (
    !db.select({ id: shoppingItems.id }).from(shoppingItems).where(mine).get()
  )
    return false;
  db.delete(shoppingItems).where(mine).run();
  return true;
};

export const clearItems = (userId: string, which: "checked" | "all") => {
  db.delete(shoppingItems)
    .where(
      which === "all"
        ? eq(shoppingItems.userId, userId)
        : and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, true))
    )
    .run();
};
