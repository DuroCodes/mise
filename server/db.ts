import { mkdirSync, unlinkSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { Database } from "bun:sqlite";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { fileURLToPath } from "node:url";
import type { Recipe, RecipeInput } from "../src/shared/recipe";
import * as schema from "./db/schema";
import {
  account,
  cookLogs,
  favorites,
  ingredients,
  instructions,
  ratings,
  recipeTags,
  recipes,
  session,
  tags,
  user,
} from "./db/schema";

export const dataDir = process.env.DATA_DIR ?? "./data";
export const uploadDir = `${dataDir}/uploads`;

mkdirSync(uploadDir, { recursive: true });

const sqlite = new Database(`${dataDir}/mise.db`);
sqlite.exec("pragma journal_mode = wal;");

export const db = drizzle(sqlite, { schema });

migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});

sqlite.exec("pragma foreign_keys = on;");

const normalizeStoredTags = () => {
  const rows = db.select().from(tags).all();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase().replace(/\s+/g, " ");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const keeper = group.find((row) => row.name === key) ?? group[0];
    if (!keeper) continue;
    const extras = group.filter((row) => row.id !== keeper.id);
    for (const extra of extras) {
      const links = db
        .select()
        .from(recipeTags)
        .where(eq(recipeTags.tagId, extra.id))
        .all();
      for (const link of links) {
        const existing = db
          .select()
          .from(recipeTags)
          .where(
            and(
              eq(recipeTags.recipeId, link.recipeId),
              eq(recipeTags.tagId, keeper.id)
            )
          )
          .get();
        if (!existing) {
          db.insert(recipeTags)
            .values({ recipeId: link.recipeId, tagId: keeper.id })
            .run();
        }
      }
      db.delete(recipeTags).where(eq(recipeTags.tagId, extra.id)).run();
      db.delete(tags).where(eq(tags.id, extra.id)).run();
    }
    if (keeper.name !== key) {
      db.update(tags).set({ name: key }).where(eq(tags.id, keeper.id)).run();
    }
  }
};

normalizeStoredTags();

const stamp = (value: Date | number) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const withRecipe = {
  ingredients: true,
  instructions: true,
  recipeTags: { with: { tag: true } },
  owner: true,
} as const;

export const canView = (
  row: { ownerId: string | null; visibility: string },
  viewerId: string
) =>
  row.ownerId === null ||
  row.ownerId === viewerId ||
  row.visibility === "public";

export const canEdit = (row: { ownerId: string | null }, viewerId: string) =>
  row.ownerId === null || row.ownerId === viewerId;

export const load = (id: string) =>
  db.query.recipes
    .findFirst({
      where: (table, operators) => operators.eq(table.id, id),
      with: withRecipe,
    })
    .sync();

export type RecipeRow = NonNullable<ReturnType<typeof load>>;

type RecipeStats = {
  rating: { average: number | null; count: number; mine: number | null };
  lastCooked: string | null;
  cookCount: number;
};

const emptyStats = (): RecipeStats => ({
  rating: { average: null, count: 0, mine: null },
  lastCooked: null,
  cookCount: 0,
});

/** Rating and cooking-log summaries for one recipe, or for all of them. */
export const recipeStats = (viewerId: string, recipeId?: string) => {
  const stats = new Map<string, RecipeStats>();
  const entry = (id: string) => {
    let value = stats.get(id);
    if (!value) {
      value = emptyStats();
      stats.set(id, value);
    }
    return value;
  };

  const ratingRows = db
    .select({
      recipeId: ratings.recipeId,
      average: sql<number>`avg(${ratings.stars})`,
      count: sql<number>`count(*)`,
      mine: sql<
        number | null
      >`max(case when ${ratings.userId} = ${viewerId} then ${ratings.stars} end)`,
    })
    .from(ratings)
    .where(recipeId ? eq(ratings.recipeId, recipeId) : undefined)
    .groupBy(ratings.recipeId)
    .all();
  for (const row of ratingRows) {
    entry(row.recipeId).rating = {
      average: Math.round(Number(row.average) * 10) / 10,
      count: Number(row.count),
      mine: row.mine === null ? null : Number(row.mine),
    };
  }

  const logRows = db
    .select({
      recipeId: cookLogs.recipeId,
      last: sql<string | null>`max(${cookLogs.cookedOn})`,
      count: sql<number>`count(*)`,
    })
    .from(cookLogs)
    .where(recipeId ? eq(cookLogs.recipeId, recipeId) : undefined)
    .groupBy(cookLogs.recipeId)
    .all();
  for (const row of logRows) {
    const value = entry(row.recipeId);
    value.lastCooked = row.last;
    value.cookCount = Number(row.count);
  }

  return (id: string) => stats.get(id) ?? emptyStats();
};

const favoriteIds = (viewerId: string) =>
  new Set(
    viewerId
      ? db
          .select({ recipeId: favorites.recipeId })
          .from(favorites)
          .where(eq(favorites.userId, viewerId))
          .all()
          .map((row) => row.recipeId)
      : []
  );

const toRecipe = (
  row: RecipeRow,
  viewerId: string,
  asAdmin: boolean,
  stats: RecipeStats,
  favorited: Set<string>
) => {
  const editable = asAdmin || canEdit(row, viewerId);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image,
    sourceUrl: row.sourceUrl,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    servings: row.servings,
    favorite: favorited.has(row.id),
    visibility: row.visibility === "private" ? "private" : "public",
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? null,
    canEdit: editable,
    shareToken: editable ? row.shareToken : null,
    rating: stats.rating,
    lastCooked: stats.lastCooked,
    cookCount: stats.cookCount,
    tags: row.recipeTags
      .map((link) => link.tag.name)
      .sort((a, b) => a.localeCompare(b)),
    ingredients: [...row.ingredients]
      .sort((a, b) => a.position - b.position)
      .map(({ amount, unit, name, note }) => ({ amount, unit, name, note })),
    instructions: [...row.instructions]
      .sort((a, b) => a.position - b.position)
      .map(({ body }) => ({ text: body })),
    createdAt: stamp(row.createdAt),
    updatedAt: stamp(row.updatedAt),
  } satisfies Recipe;
};

export const getRecipe = (id: string, viewerId: string, asAdmin = false) => {
  const row = load(id);
  if (!row || (!asAdmin && !canView(row, viewerId))) return null;
  return toRecipe(row, viewerId, asAdmin, recipeStats(viewerId, id)(id), favoriteIds(viewerId));
};

/** True when the viewer may see the recipe (admins see everything). */
export const viewable = (id: string, viewerId: string, asAdmin = false) => {
  const row = db
    .select({ ownerId: recipes.ownerId, visibility: recipes.visibility })
    .from(recipes)
    .where(eq(recipes.id, id))
    .get();
  return Boolean(row && (asAdmin || canView(row, viewerId)));
};

export const listAllRecipes = () =>
  db.query.recipes
    .findMany({ with: { owner: true } })
    .sync()
    .map((row) => ({
      id: row.id,
      title: row.title,
      visibility: row.visibility === "private" ? "private" : "public",
      ownerId: row.ownerId,
      ownerName: row.owner?.name ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

export const hasRecipes = () =>
  Boolean(db.select({ id: recipes.id }).from(recipes).get());

export const listRecipes = (viewerId: string) => {
  const stats = recipeStats(viewerId);
  const favorited = favoriteIds(viewerId);
  return db.query.recipes
    .findMany({ with: withRecipe })
    .sync()
    .filter((row) => canView(row, viewerId))
    .map((row) => toRecipe(row, viewerId, false, stats(row.id), favorited))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

export const listTags = (viewerId: string) =>
  db
    .selectDistinct({ name: tags.name })
    .from(tags)
    .innerJoin(recipeTags, eq(recipeTags.tagId, tags.id))
    .innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
    .where(
      or(
        isNull(recipes.ownerId),
        eq(recipes.ownerId, viewerId),
        eq(recipes.visibility, "public")
      )
    )
    .all()
    .map((tag) => tag.name)
    .sort((a, b) => a.localeCompare(b));

const uploadName = (url: string | null) => {
  if (!url) return null;
  const match = url.match(
    /^\/uploads\/([0-9a-f-]{36}\.(?:jpe?g|png|webp|gif|avif))$/i
  );
  return match?.[1] ?? null;
};

export const removeUpload = (url: string | null) => {
  const name = uploadName(url);
  if (!name) return;
  try {
    unlinkSync(`${uploadDir}/${name}`);
  } catch {
    // The file is already gone.
  }
};

export const writeRecipe = (
  id: string,
  input: RecipeInput,
  createdAt: Date,
  ownerId: string | null,
  updatedAt: Date = new Date()
) => {
  const now = updatedAt;
  const visibility = ownerId ? input.visibility : "public";

  db.transaction((tx) => {
    tx.insert(recipes)
      .values({
        id,
        title: input.title,
        description: input.description,
        image: input.image,
        sourceUrl: input.sourceUrl,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        servings: input.servings,
        visibility,
        ownerId,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: recipes.id,
        set: {
          title: input.title,
          description: input.description,
          image: input.image,
          sourceUrl: input.sourceUrl,
          prepMinutes: input.prepMinutes,
          cookMinutes: input.cookMinutes,
          servings: input.servings,
          visibility,
          updatedAt: now,
        },
      })
      .run();

    tx.delete(ingredients).where(eq(ingredients.recipeId, id)).run();
    tx.delete(instructions).where(eq(instructions.recipeId, id)).run();
    tx.delete(recipeTags).where(eq(recipeTags.recipeId, id)).run();

    if (input.ingredients.length) {
      tx.insert(ingredients)
        .values(
          input.ingredients.map((item, position) => ({
            id: crypto.randomUUID(),
            recipeId: id,
            position,
            amount: item.amount,
            unit: item.unit,
            name: item.name,
            note: item.note,
          }))
        )
        .run();
    }

    if (input.instructions.length) {
      tx.insert(instructions)
        .values(
          input.instructions.map((item, position) => ({
            id: crypto.randomUUID(),
            recipeId: id,
            position,
            body: item.text,
          }))
        )
        .run();
    }

    for (const name of input.tags) {
      const existing = tx
        .select()
        .from(tags)
        .where(sql`lower(${tags.name}) = lower(${name})`)
        .get();
      const tagId = existing?.id ?? crypto.randomUUID();
      if (!existing) tx.insert(tags).values({ id: tagId, name }).run();
      tx.insert(recipeTags).values({ recipeId: id, tagId }).run();
    }

    tx.run(
      sql`delete from tags where id not in (select tag_id from recipe_tags)`
    );
  });
};

export const setFavorite = (userId: string, recipeId: string, on: boolean) => {
  if (!userId) return;
  if (on) {
    db.insert(favorites)
      .values({ userId, recipeId })
      .onConflictDoNothing()
      .run();
    return;
  }
  db.delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.recipeId, recipeId)))
    .run();
};

export const createRecipe = (input: RecipeInput, ownerId: string | null) => {
  const id = crypto.randomUUID();
  writeRecipe(id, input, new Date(), ownerId);
  if (ownerId) setFavorite(ownerId, id, input.favorite);
  return getRecipe(id, ownerId ?? "");
};

export const updateRecipe = (
  id: string,
  input: RecipeInput,
  viewerId: string,
  asAdmin = false
) => {
  const current = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!current || (!asAdmin && !canEdit(current, viewerId))) return null;
  writeRecipe(id, input, current.createdAt, current.ownerId);
  setFavorite(viewerId, id, input.favorite);
  if (current.image && current.image !== input.image && !uploadInUse(current.image))
    removeUpload(current.image);
  return getRecipe(id, viewerId);
};

export const deleteRecipe = (id: string, viewerId: string, asAdmin = false) => {
  const current = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!current || (!asAdmin && !canEdit(current, viewerId))) return false;
  db.delete(recipes).where(eq(recipes.id, id)).run();
  db.run(
    sql`delete from tags where id not in (select tag_id from recipe_tags)`
  );
  if (current.image && !uploadInUse(current.image)) removeUpload(current.image);
  return true;
};

export const toggleFavorite = (id: string, viewerId: string) => {
  const current = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!current || !canView(current, viewerId)) return null;
  const favorite = !favoriteIds(viewerId).has(id);
  setFavorite(viewerId, id, favorite);
  return { favorite };
};

export const countUsers = () => {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .get();
  return Number(row?.count ?? 0);
};

export const listUsers = () =>
  db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .orderBy(user.createdAt)
    .all();

export const emailTaken = (email: string) => {
  const needle = email.trim().toLowerCase();
  return listUsers().some((person) => person.email.toLowerCase() === needle);
};

export const removeUser = (id: string) => {
  const current = db.select().from(user).where(eq(user.id, id)).get();
  if (!current) return "missing" as const;
  if (current.role === "admin") {
    const admins = db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))
      .all();
    if (admins.length <= 1) return "last-admin" as const;
  }
  db.delete(user).where(eq(user.id, id)).run();
  return "deleted" as const;
};

export const setUserRole = (id: string, role: "admin" | "member") => {
  const current = db.select().from(user).where(eq(user.id, id)).get();
  if (!current) return "missing" as const;
  if (current.role === "admin" && role === "member") {
    const admins = db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))
      .all();
    if (admins.length <= 1) return "last-admin" as const;
  }
  db.update(user).set({ role }).where(eq(user.id, id)).run();
  return "updated" as const;
};

export const setUserPassword = async (
  id: string,
  password: string,
  keepSessions: boolean
) => {
  const current = db.select().from(user).where(eq(user.id, id)).get();
  if (!current) return "missing" as const;
  const credential = db
    .select()
    .from(account)
    .where(and(eq(account.userId, id), eq(account.providerId, "credential")))
    .get();
  if (!credential) return "missing" as const;
  const hashed = await hashPassword(password);
  db.update(account)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(account.id, credential.id))
    .run();
  if (!keepSessions) db.delete(session).where(eq(session.userId, id)).run();
  return "updated" as const;
};

export const uploadInUse = (url: string) =>
  Boolean(
    db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.image, url))
      .get()
  );
