import { and, asc, eq, sql } from "drizzle-orm";
import { canView, db, getRecipe } from "./db";
import { collectionRecipes, collections, recipes } from "./db/schema";

const owned = (userId: string, id: string) =>
  db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .get();

const members = (collectionId: string) =>
  db
    .select({
      recipeId: collectionRecipes.recipeId,
      image: recipes.image,
      ownerId: recipes.ownerId,
      visibility: recipes.visibility,
    })
    .from(collectionRecipes)
    .innerJoin(recipes, eq(recipes.id, collectionRecipes.recipeId))
    .where(eq(collectionRecipes.collectionId, collectionId))
    .orderBy(asc(collectionRecipes.position))
    .all();

export const listCollections = (userId: string, asAdmin: boolean) =>
  db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(asc(collections.name))
    .all()
    .map((row) => {
      const visible = members(row.id).filter(
        (item) => asAdmin || canView(item, userId)
      );
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        count: visible.length,
        images: visible
          .map((item) => item.image)
          .filter((image): image is string => Boolean(image))
          .slice(0, 4),
      };
    });

export const getCollection = (userId: string, id: string, asAdmin: boolean) => {
  const row = owned(userId, id);
  if (!row) return null;
  const list = members(id)
    .map((item) => getRecipe(item.recipeId, userId, asAdmin))
    .filter((recipe) => recipe !== null);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    recipes: list,
  };
};

export const createCollection = (
  userId: string,
  input: { name: string; description: string }
) => {
  const id = crypto.randomUUID();
  const now = new Date();
  db.insert(collections)
    .values({ id, userId, ...input, createdAt: now, updatedAt: now })
    .run();
  return id;
};

export const updateCollection = (
  userId: string,
  id: string,
  input: { name?: string; description?: string }
) => {
  if (!owned(userId, id)) return false;
  db.update(collections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .run();
  return true;
};

export const deleteCollection = (userId: string, id: string) => {
  if (!owned(userId, id)) return false;
  db.delete(collections).where(eq(collections.id, id)).run();
  return true;
};

export const addToCollection = (
  userId: string,
  collectionId: string,
  recipeId: string
) => {
  if (!owned(userId, collectionId)) return false;
  const top = db
    .select({ max: sql<number | null>`max(${collectionRecipes.position})` })
    .from(collectionRecipes)
    .where(eq(collectionRecipes.collectionId, collectionId))
    .get();
  db.insert(collectionRecipes)
    .values({
      collectionId,
      recipeId,
      position: Number(top?.max ?? -1) + 1,
      addedAt: new Date(),
    })
    .onConflictDoNothing()
    .run();
  db.update(collections)
    .set({ updatedAt: new Date() })
    .where(eq(collections.id, collectionId))
    .run();
  return true;
};

export const removeFromCollection = (
  userId: string,
  collectionId: string,
  recipeId: string
) => {
  if (!owned(userId, collectionId)) return false;
  db.delete(collectionRecipes)
    .where(
      and(
        eq(collectionRecipes.collectionId, collectionId),
        eq(collectionRecipes.recipeId, recipeId)
      )
    )
    .run();
  return true;
};

export const collectionsForRecipe = (userId: string, recipeId: string) =>
  db
    .select({ id: collections.id })
    .from(collectionRecipes)
    .innerJoin(collections, eq(collections.id, collectionRecipes.collectionId))
    .where(
      and(
        eq(collections.userId, userId),
        eq(collectionRecipes.recipeId, recipeId)
      )
    )
    .all()
    .map((row) => row.id);
