import { and, asc, eq } from "drizzle-orm";
import { covers, isStaple, rankRecipes } from "../src/shared/pantry";
import { combineQuantities, itemKey } from "../src/shared/shopping";
import { db, listRecipes } from "./db";
import { pantryItems, shoppingItems } from "./db/schema";

export type PantryLine = {
  name: string;
  amount: string;
  unit: string;
  note: string;
  expiresOn?: string | null;
};

const toItem = (row: typeof pantryItems.$inferSelect) => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  unit: row.unit,
  note: row.note,
  expiresOn: row.expiresOn,
});

export const listPantry = (userId: string) =>
  db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId))
    .orderBy(asc(pantryItems.name))
    .all()
    .map(toItem);

/**
 * adds lines to the pantry, joining an existing item with the same name when
 * the amounts add up. The earliest expiry date wins.
 */
export const addToPantry = (userId: string, lines: PantryLine[]) => {
  db.transaction((tx) => {
    const rows = tx
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .all();
    for (const line of lines) {
      const name = line.name.trim().slice(0, 200);
      const key = itemKey(name);
      if (!key) continue;
      const now = new Date();
      let merged = false;
      for (const row of rows) {
        if (itemKey(row.name) !== key) continue;
        const sum = combineQuantities(
          { amount: row.amount, unit: row.unit },
          { amount: line.amount.trim(), unit: line.unit.trim() }
        );
        if (!sum) continue;
        const expiresOn =
          row.expiresOn && line.expiresOn
            ? row.expiresOn < line.expiresOn
              ? row.expiresOn
              : line.expiresOn
            : (row.expiresOn ?? line.expiresOn ?? null);
        row.amount = sum.amount.slice(0, 40);
        row.unit = sum.unit.slice(0, 40);
        row.expiresOn = expiresOn;
        tx.update(pantryItems)
          .set({
            amount: row.amount,
            unit: row.unit,
            expiresOn,
            updatedAt: now,
          })
          .where(eq(pantryItems.id, row.id))
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
        expiresOn: line.expiresOn ?? null,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(pantryItems).values(row).run();
      rows.push(row);
    }
  });
};

const mine = (userId: string, id: string) =>
  and(eq(pantryItems.id, id), eq(pantryItems.userId, userId));

export const updatePantryItem = (
  userId: string,
  id: string,
  patch: Partial<Omit<PantryLine, "expiresOn"> & { expiresOn: string | null }>
) => {
  if (
    !db
      .select({ id: pantryItems.id })
      .from(pantryItems)
      .where(mine(userId, id))
      .get()
  )
    return false;
  db.update(pantryItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(mine(userId, id))
    .run();
  return true;
};

export const removePantryItem = (userId: string, id: string) => {
  if (
    !db
      .select({ id: pantryItems.id })
      .from(pantryItems)
      .where(mine(userId, id))
      .get()
  )
    return false;
  db.delete(pantryItems).where(mine(userId, id)).run();
  return true;
};

export const moveCheckedToPantry = (userId: string) => {
  const checked = db
    .select()
    .from(shoppingItems)
    .where(
      and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, true))
    )
    .all();
  if (!checked.length) return 0;
  addToPantry(
    userId,
    checked.map((item) => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      note: "",
    }))
  );
  db.delete(shoppingItems)
    .where(
      and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, true))
    )
    .run();
  return checked.length;
};

export const finishShopping = (
  userId: string,
  keep: { id: string; amount: string; unit: string }[]
) => {
  const checked = db
    .select()
    .from(shoppingItems)
    .where(
      and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, true))
    )
    .all();
  const byId = new Map(checked.map((item) => [item.id, item]));
  const lines: PantryLine[] = [];
  for (const entry of keep) {
    const item = byId.get(entry.id);
    if (!item) continue;
    if (/^0+(?:\.0+)?$/.test(entry.amount.trim())) continue;
    lines.push({
      name: item.name,
      amount: entry.amount,
      unit: entry.unit,
      note: "",
    });
  }
  if (lines.length) addToPantry(userId, lines);
  if (checked.length)
    db.delete(shoppingItems)
      .where(
        and(eq(shoppingItems.userId, userId), eq(shoppingItems.checked, true))
      )
      .run();
  return { kept: lines.length, cleared: checked.length };
};

export const pantrySuggestions = (userId: string, today: string) => {
  const pantry = listPantry(userId);
  if (!pantry.length) return [];
  return rankRecipes(listRecipes(userId), pantry, today)
    .slice(0, 30)
    .map((match) => ({
      id: match.recipe.id,
      title: match.recipe.title,
      image: match.recipe.image,
      prepMinutes: match.recipe.prepMinutes,
      cookMinutes: match.recipe.cookMinutes,
      have: match.have,
      missing: match.missing,
      expiring: match.expiring,
      coverage: Math.round(match.coverage * 100) / 100,
    }));
};

export const missingFor = (
  userId: string,
  recipe: { ingredients: { name: string; note: string }[] }
) => {
  const pantry = listPantry(userId);
  return new Set(
    recipe.ingredients
      .filter(
        (item) =>
          !isStaple(item.name) &&
          !/\boptional\b/i.test(item.note) &&
          !pantry.some((entry) => covers(entry.name, item.name))
      )
      .map((item) => item.name)
  );
};
