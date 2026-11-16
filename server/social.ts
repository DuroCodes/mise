import { and, desc, eq } from "drizzle-orm";
import type { SharedRecipe } from "../src/shared/recipe";
import { db } from "./db";
import { cookLogs, ratings, recipes, user } from "./db/schema";

export const setRating = (
  recipeId: string,
  userId: string,
  stars: number | null
) => {
  if (stars === null) {
    db.delete(ratings)
      .where(and(eq(ratings.recipeId, recipeId), eq(ratings.userId, userId)))
      .run();
    return;
  }
  db.insert(ratings)
    .values({ recipeId, userId, stars, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [ratings.recipeId, ratings.userId],
      set: { stars, updatedAt: new Date() },
    })
    .run();
};

export const listLogs = (recipeId: string) =>
  db
    .select({
      id: cookLogs.id,
      cookedOn: cookLogs.cookedOn,
      note: cookLogs.note,
      userId: cookLogs.userId,
      userName: user.name,
    })
    .from(cookLogs)
    .innerJoin(user, eq(user.id, cookLogs.userId))
    .where(eq(cookLogs.recipeId, recipeId))
    .orderBy(desc(cookLogs.cookedOn), desc(cookLogs.createdAt))
    .all();

export const addLog = (
  recipeId: string,
  userId: string,
  cookedOn: string,
  note: string
) => {
  db.insert(cookLogs)
    .values({
      id: crypto.randomUUID(),
      recipeId,
      userId,
      cookedOn,
      note,
      createdAt: new Date(),
    })
    .run();
};

export const removeLog = (id: string, userId: string, asAdmin: boolean) => {
  const row = db.select().from(cookLogs).where(eq(cookLogs.id, id)).get();
  if (!row) return "missing" as const;
  if (row.userId !== userId && !asAdmin) return "forbidden" as const;
  db.delete(cookLogs).where(eq(cookLogs.id, id)).run();
  return "deleted" as const;
};

const newToken = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString(
    "base64url"
  );

export const tokenShape = /^[A-Za-z0-9_-]{20,64}$/;

export const createShare = (recipeId: string) => {
  const row = db
    .select({ shareToken: recipes.shareToken })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .get();
  if (!row) return null;
  if (row.shareToken) return row.shareToken;
  const token = newToken();
  db.update(recipes)
    .set({ shareToken: token })
    .where(eq(recipes.id, recipeId))
    .run();
  return token;
};

export const removeShare = (recipeId: string) => {
  db.update(recipes)
    .set({ shareToken: null })
    .where(eq(recipes.id, recipeId))
    .run();
};

export const sharedRecipe = (token: string): SharedRecipe | null => {
  if (!tokenShape.test(token)) return null;
  const row = db.query.recipes
    .findFirst({
      where: (table, operators) => operators.eq(table.shareToken, token),
      with: {
        ingredients: true,
        instructions: true,
        recipeTags: { with: { tag: true } },
        owner: true,
      },
    })
    .sync();
  if (!row) return null;
  return {
    title: row.title,
    description: row.description,
    image: row.image,
    sourceUrl: row.sourceUrl,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    servings: row.servings,
    ownerName: row.owner?.name ?? null,
    tags: row.recipeTags
      .map((link) => link.tag.name)
      .sort((a, b) => a.localeCompare(b)),
    ingredients: [...row.ingredients]
      .sort((a, b) => a.position - b.position)
      .map(({ amount, unit, name, note }) => ({ amount, unit, name, note })),
    instructions: [...row.instructions]
      .sort((a, b) => a.position - b.position)
      .map(({ body }) => ({ text: body })),
  };
};
