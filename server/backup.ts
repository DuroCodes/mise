import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { recipeInput, isoDay, type RecipeInput } from "../src/shared/recipe";
import { dataDir, db, setFavorite, uploadDir, writeRecipe } from "./db";
import {
  collectionRecipes,
  collections,
  cookLogs,
  favorites,
  mealPlan,
  ratings,
  recipes,
  pantryItems,
  shoppingItems,
  stores,
  user,
} from "./db/schema";
import { parseLayout, storeLayout } from "../src/shared/stores";
import { slots } from "./plan";

const uploadName = /^[0-9a-f-]{36}\.(?:jpe?g|png|webp|gif|avif)$/i;
const maxUnpacked = 1024 * 1024 * 1024;

const stamp = (value: Date) => value.toISOString();

export const exportData = () => {
  const people = db.select().from(user).all();
  const emailOf = new Map(people.map((person) => [person.id, person.email]));

  const recipeRows = db.query.recipes
    .findMany({
      with: {
        ingredients: true,
        instructions: true,
        recipeTags: { with: { tag: true } },
      },
    })
    .sync();

  return {
    format: "mise-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    people: people.map((person) => ({
      name: person.name,
      email: person.email,
      role: person.role,
    })),
    recipes: recipeRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      image: row.image,
      sourceUrl: row.sourceUrl,
      prepMinutes: row.prepMinutes,
      cookMinutes: row.cookMinutes,
      servings: row.servings,
      favorite: false,
      visibility: row.visibility === "private" ? "private" : "public",
      ownerEmail: row.ownerId ? (emailOf.get(row.ownerId) ?? null) : null,
      tags: row.recipeTags.map((link) => link.tag.name),
      ingredients: [...row.ingredients]
        .sort((a, b) => a.position - b.position)
        .map(({ amount, unit, name, note }) => ({ amount, unit, name, note })),
      instructions: [...row.instructions]
        .sort((a, b) => a.position - b.position)
        .map(({ body }) => ({ text: body })),
      createdAt: stamp(row.createdAt),
      updatedAt: stamp(row.updatedAt),
    })),
    favorites: db
      .select()
      .from(favorites)
      .all()
      .map((row) => ({
        recipeId: row.recipeId,
        userEmail: emailOf.get(row.userId) ?? null,
      })),
    ratings: db
      .select()
      .from(ratings)
      .all()
      .map((row) => ({
        recipeId: row.recipeId,
        userEmail: emailOf.get(row.userId) ?? null,
        stars: row.stars,
        updatedAt: stamp(row.updatedAt),
      })),
    cookLogs: db
      .select()
      .from(cookLogs)
      .all()
      .map((row) => ({
        id: row.id,
        recipeId: row.recipeId,
        userEmail: emailOf.get(row.userId) ?? null,
        cookedOn: row.cookedOn,
        note: row.note,
        createdAt: stamp(row.createdAt),
      })),
    collections: db
      .select()
      .from(collections)
      .all()
      .map((row) => ({
        id: row.id,
        userEmail: emailOf.get(row.userId) ?? null,
        name: row.name,
        description: row.description,
        createdAt: stamp(row.createdAt),
        updatedAt: stamp(row.updatedAt),
        recipeIds: db
          .select()
          .from(collectionRecipes)
          .all()
          .filter((link) => link.collectionId === row.id)
          .sort((a, b) => a.position - b.position)
          .map((link) => link.recipeId),
      })),
    mealPlan: db
      .select()
      .from(mealPlan)
      .all()
      .map((row) => ({
        id: row.id,
        userEmail: emailOf.get(row.userId) ?? null,
        day: row.day,
        slot: row.slot,
        position: row.position,
        recipeId: row.recipeId,
        servings: row.servings,
        createdAt: stamp(row.createdAt),
      })),
    shopping: db
      .select()
      .from(shoppingItems)
      .all()
      .map((row) => ({
        id: row.id,
        userEmail: emailOf.get(row.userId) ?? null,
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        note: row.note,
        sources: row.sources,
        checked: row.checked,
        position: row.position,
        createdAt: stamp(row.createdAt),
      })),
    stores: db
      .select()
      .from(stores)
      .all()
      .map((row) => ({
        id: row.id,
        userEmail: emailOf.get(row.userId) ?? null,
        name: row.name,
        layout: parseLayout(row.layout),
        createdAt: stamp(row.createdAt),
        updatedAt: stamp(row.updatedAt),
      })),
    pantry: db
      .select()
      .from(pantryItems)
      .all()
      .map((row) => ({
        id: row.id,
        userEmail: emailOf.get(row.userId) ?? null,
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        note: row.note,
        expiresOn: row.expiresOn,
        createdAt: stamp(row.createdAt),
        updatedAt: stamp(row.updatedAt),
      })),
  };
};

/**
 * a zip with mise.json (portable data), every referenced upload, and a
 * consistent copy of the SQLite database (which includes accounts).
 */
export const createBackupZip = () => {
  const data = exportData();
  const files: Zippable = {
    "mise.json": strToU8(JSON.stringify(data, null, 2)),
  };

  for (const recipe of data.recipes) {
    const name = recipe.image?.startsWith("/uploads/")
      ? recipe.image.slice("/uploads/".length)
      : null;
    if (!name || !uploadName.test(name)) continue;
    const path = `${uploadDir}/${name}`;
    if (existsSync(path))
      files[`uploads/${name}`] = [readFileSync(path), { level: 0 }];
  }

  const snapshot = `${dataDir}/backup-${crypto.randomUUID()}.db`;
  try {
    db.run(`vacuum into '${snapshot.replace(/'/g, "''")}'`);
    files["mise.db"] = readFileSync(snapshot);
  } finally {
    rmSync(snapshot, { force: true });
  }

  return zipSync(files, { level: 6 });
};

const when = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const email = z.string().nullable();

const backupSchema = z.object({
  format: z.literal("mise-backup"),
  version: z.literal(1),
  recipes: z.array(
    recipeInput.extend({
      id: z.string().min(1).max(64),
      ownerEmail: email,
      createdAt: when,
      updatedAt: when,
    })
  ),
  favorites: z
    .array(
      z.object({
        recipeId: z.string(),
        userEmail: email,
      })
    )
    .default([]),
  ratings: z
    .array(
      z.object({
        recipeId: z.string(),
        userEmail: email,
        stars: z.number().int().min(1).max(5),
        updatedAt: when,
      })
    )
    .default([]),
  cookLogs: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        recipeId: z.string(),
        userEmail: email,
        cookedOn: isoDay,
        note: z.string().max(1000),
        createdAt: when,
      })
    )
    .default([]),
  collections: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        userEmail: email,
        name: z.string().trim().min(1).max(80),
        description: z.string().max(500),
        createdAt: when,
        updatedAt: when,
        recipeIds: z.array(z.string()),
      })
    )
    .default([]),
  mealPlan: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        userEmail: email,
        day: isoDay,
        slot: z.enum(slots),
        position: z.number().int(),
        recipeId: z.string(),
        servings: z.number().int().min(1).max(999).nullable(),
        createdAt: when,
      })
    )
    .default([]),
  shopping: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        userEmail: email,
        name: z.string().min(1).max(200),
        amount: z.string().max(40),
        unit: z.string().max(40),
        note: z.string().max(200),
        sources: z.string().max(4000),
        checked: z.boolean(),
        position: z.number().int(),
        createdAt: when,
      })
    )
    .default([]),
  stores: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        userEmail: email,
        name: z.string().trim().min(1).max(60),
        layout: storeLayout,
        createdAt: when,
        updatedAt: when,
      })
    )
    .default([]),
  pantry: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        userEmail: email,
        name: z.string().min(1).max(200),
        amount: z.string().max(40),
        unit: z.string().max(40),
        note: z.string().max(200),
        expiresOn: isoDay.nullable(),
        createdAt: when,
        updatedAt: when,
      })
    )
    .default([]),
});

export type RestoreSummary = {
  recipes: number;
  images: number;
  ratings: number;
  cookLogs: number;
  collections: number;
  mealPlan: number;
  shopping: number;
  stores: number;
  pantry: number;
  skipped: number;
};

/**
 * merges a backup into this site. Recipes and other rows keep their ids, so
 * restoring the same backup twice updates instead of duplicating. People are
 * matched by email; rows for people who do not have an account here are
 * skipped, and recipes whose owner is missing go to the restoring admin.
 */
export const restoreBackup = (
  fileName: string,
  bytes: Uint8Array,
  adminId: string
) => {
  let json: string;
  let uploads: Record<string, Uint8Array> = {};
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    let total = 0;
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes, {
        filter: (file) => {
          if (file.name !== "mise.json" && !file.name.startsWith("uploads/"))
            return false;
          total += file.originalSize;
          return total <= maxUnpacked;
        },
      });
    } catch {
      return { ok: false as const, error: "Could not open that zip file" };
    }
    const data = files["mise.json"];
    if (!data)
      return { ok: false as const, error: "That zip has no mise.json" };
    json = strFromU8(data);
    uploads = files;
  } else if (fileName.toLowerCase().endsWith(".json")) {
    json = strFromU8(bytes);
  } else {
    return {
      ok: false as const,
      error: "Choose a mise backup (.zip or .json)",
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false as const, error: "The backup file is not valid JSON" };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false as const,
      error: "That is not a mise backup this version can read",
    };
  const backup = parsed.data;

  const people = db.select({ id: user.id, email: user.email }).from(user).all();
  const idOf = new Map(
    people.map((person) => [person.email.toLowerCase(), person.id])
  );
  const personFor = (value: string | null) =>
    value ? (idOf.get(value.toLowerCase()) ?? null) : null;

  const summary: RestoreSummary = {
    recipes: 0,
    images: 0,
    ratings: 0,
    cookLogs: 0,
    collections: 0,
    mealPlan: 0,
    shopping: 0,
    stores: 0,
    pantry: 0,
    skipped: 0,
  };

  for (const entry of backup.recipes) {
    const { id, ownerEmail, createdAt, updatedAt, ...rest } = entry;
    const input: RecipeInput = rest;
    const name = input.image?.startsWith("/uploads/")
      ? input.image.slice("/uploads/".length)
      : null;
    if (name && uploadName.test(name)) {
      const target = `${uploadDir}/${name}`;
      const file = uploads[`uploads/${name}`];
      if (file && !existsSync(target)) {
        writeFileSync(target, file);
        summary.images += 1;
      }
    }
    const ownerId = personFor(ownerEmail) ?? (ownerEmail ? adminId : null);
    writeRecipe(id, input, createdAt, ownerId, updatedAt);
    summary.recipes += 1;
  }

  if (backup.favorites.length > 0) {
    for (const favorite of backup.favorites) {
      const userId = personFor(favorite.userEmail);
      if (!userId) continue;
      setFavorite(userId, favorite.recipeId, true);
    }
  } else {
    for (const entry of backup.recipes) {
      if (!entry.favorite) continue;
      const ownerId =
        personFor(entry.ownerEmail) ?? (entry.ownerEmail ? adminId : null);
      if (ownerId) setFavorite(ownerId, entry.id, true);
    }
  }

  const recipeIds = new Set(
    db
      .select({ id: recipes.id })
      .from(recipes)
      .all()
      .map((row) => row.id)
  );

  db.transaction((tx) => {
    for (const row of backup.ratings) {
      const userId = personFor(row.userEmail);
      if (!userId || !recipeIds.has(row.recipeId)) {
        summary.skipped += 1;
        continue;
      }
      tx.insert(ratings)
        .values({ ...row, userId })
        .onConflictDoUpdate({
          target: [ratings.recipeId, ratings.userId],
          set: { stars: row.stars, updatedAt: row.updatedAt },
        })
        .run();
      summary.ratings += 1;
    }

    for (const row of backup.cookLogs) {
      const userId = personFor(row.userEmail);
      if (!userId || !recipeIds.has(row.recipeId)) {
        summary.skipped += 1;
        continue;
      }
      const { userEmail: _email, ...values } = row;
      tx.insert(cookLogs)
        .values({ ...values, userId })
        .onConflictDoUpdate({
          target: cookLogs.id,
          set: { cookedOn: row.cookedOn, note: row.note },
        })
        .run();
      summary.cookLogs += 1;
    }

    for (const row of backup.collections) {
      const userId = personFor(row.userEmail);
      if (!userId) {
        summary.skipped += 1;
        continue;
      }
      tx.insert(collections)
        .values({
          id: row.id,
          userId,
          name: row.name,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
          target: collections.id,
          set: {
            name: row.name,
            description: row.description,
            updatedAt: row.updatedAt,
          },
        })
        .run();
      row.recipeIds
        .filter((recipeId) => recipeIds.has(recipeId))
        .forEach((recipeId, position) => {
          tx.insert(collectionRecipes)
            .values({
              collectionId: row.id,
              recipeId,
              position,
              addedAt: row.updatedAt,
            })
            .onConflictDoNothing()
            .run();
        });
      summary.collections += 1;
    }

    for (const row of backup.mealPlan) {
      const userId = personFor(row.userEmail);
      if (!userId || !recipeIds.has(row.recipeId)) {
        summary.skipped += 1;
        continue;
      }
      const { userEmail: _email, ...values } = row;
      tx.insert(mealPlan)
        .values({ ...values, userId })
        .onConflictDoNothing()
        .run();
      summary.mealPlan += 1;
    }

    for (const row of backup.shopping) {
      const userId = personFor(row.userEmail);
      if (!userId) {
        summary.skipped += 1;
        continue;
      }
      const { userEmail: _email, ...values } = row;
      tx.insert(shoppingItems)
        .values({ ...values, userId })
        .onConflictDoNothing()
        .run();
      summary.shopping += 1;
    }

    for (const row of backup.stores) {
      const userId = personFor(row.userEmail);
      if (!userId) {
        summary.skipped += 1;
        continue;
      }
      tx.insert(stores)
        .values({
          id: row.id,
          userId,
          name: row.name,
          layout: JSON.stringify(row.layout),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoNothing()
        .run();
      summary.stores += 1;
    }

    for (const row of backup.pantry) {
      const userId = personFor(row.userEmail);
      if (!userId) {
        summary.skipped += 1;
        continue;
      }
      const { userEmail: _email, ...values } = row;
      tx.insert(pantryItems)
        .values({ ...values, userId })
        .onConflictDoNothing()
        .run();
      summary.pantry += 1;
    }
  });

  return { ok: true as const, summary };
};
