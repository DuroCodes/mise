import { z } from "zod";
import { isoDay } from "../src/shared/recipe";
import { aiEnabled, aiImageTypes, askAboutRecipe, extractRecipe } from "./ai";
import { isAdmin, readJson, type Api } from "./api";
import { createBackupZip, restoreBackup } from "./backup";
import {
  addToCollection,
  collectionsForRecipe,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  removeFromCollection,
  updateCollection,
} from "./collections";
import { canEdit, createRecipe, db, getRecipe, viewable } from "./db";
import { recipes } from "./db/schema";
import { maxImportBytes, maxImportRecipes, readImportFile } from "./import-file";
import { addPlan, listPlan, removePlan, slots, updatePlan } from "./plan";
import {
  clearItems,
  listShopping,
  mergeLines,
  recipeLines,
  removeItem,
  updateItem,
} from "./shopping";
import {
  addLog,
  createShare,
  listLogs,
  removeLog,
  removeShare,
  setRating,
} from "./social";
import { createStore, deleteStore, listStores, updateStore } from "./stores";
import { saveUpload } from "./uploads";
import { storeLayout } from "../src/shared/stores";
import { eq } from "drizzle-orm";

const measure = z.enum(["original", "metric", "imperial"]).default("original");
const servings = z.number().int().min(1).max(999).nullable();

const ownerOf = (id: string) =>
  db
    .select({ ownerId: recipes.ownerId })
    .from(recipes)
    .where(eq(recipes.id, id))
    .get();

export const registerRoutes = (api: Api) => {
  api.get("/features", (c) => c.json({ ai: aiEnabled() }));

  // Ratings and cooking log -------------------------------------------------

  api.post("/recipes/:id/rating", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!viewable(id, user.id, isAdmin(user)))
      return c.json({ error: "Recipe not found" }, 404);
    const parsed = z
      .object({ stars: z.number().int().min(1).max(5).nullable() })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Pick 1 to 5 stars" }, 400);
    setRating(id, user.id, parsed.data.stars);
    const recipe = getRecipe(id, user.id, isAdmin(user));
    return c.json(recipe?.rating ?? null);
  });

  api.get("/recipes/:id/logs", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!viewable(id, user.id, isAdmin(user)))
      return c.json({ error: "Recipe not found" }, 404);
    return c.json(listLogs(id));
  });

  api.post("/recipes/:id/logs", async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!viewable(id, user.id, isAdmin(user)))
      return c.json({ error: "Recipe not found" }, 404);
    const parsed = z
      .object({
        cookedOn: isoDay,
        note: z.string().trim().max(1000).default(""),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "Pick a date and keep the note short" }, 400);
    addLog(id, user.id, parsed.data.cookedOn, parsed.data.note);
    return c.json(listLogs(id), 201);
  });

  api.delete("/logs/:id", (c) => {
    const user = c.get("user");
    const result = removeLog(c.req.param("id"), user.id, isAdmin(user));
    if (result === "missing") return c.json({ error: "Entry not found" }, 404);
    if (result === "forbidden")
      return c.json({ error: "You can only remove your own entries" }, 403);
    return c.json(null);
  });

  // Share links --------------------------------------------------------------

  const editable = (id: string, user: { id: string; role: string }) => {
    const row = ownerOf(id);
    return Boolean(row && (user.role === "admin" || canEdit(row, user.id)));
  };

  api.post("/recipes/:id/share", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!editable(id, user)) return c.json({ error: "Recipe not found" }, 404);
    const token = createShare(id);
    if (!token) return c.json({ error: "Recipe not found" }, 404);
    return c.json({ token });
  });

  api.delete("/recipes/:id/share", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!editable(id, user)) return c.json({ error: "Recipe not found" }, 404);
    removeShare(id);
    return c.json(null);
  });

  // Shopping list ------------------------------------------------------------

  // Defaults live only on the create schema: zod applies a field's default
  // even inside .partial(), which would blank fields a PATCH didn't send.
  const itemFields = {
    name: z.string().trim().min(1).max(200),
    amount: z.string().trim().max(40),
    unit: z.string().trim().max(40),
    note: z.string().trim().max(200),
  };
  const itemInput = z.object({
    name: itemFields.name,
    amount: itemFields.amount.default(""),
    unit: itemFields.unit.default(""),
    note: itemFields.note.default(""),
  });
  const itemPatch = z
    .object({ ...itemFields, checked: z.boolean() })
    .partial()
    .strict();

  api.get("/shopping", (c) => c.json(listShopping(c.get("user").id)));

  api.post("/shopping", async (c) => {
    const parsed = itemInput.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Name the item" }, 400);
    const userId = c.get("user").id;
    mergeLines(userId, [parsed.data]);
    return c.json(listShopping(userId), 201);
  });

  api.post("/shopping/recipes", async (c) => {
    const user = c.get("user");
    const parsed = z
      .object({
        entries: z
          .array(
            z.object({
              recipeId: z.string(),
              servings: z.number().min(0.5).max(999).nullable(),
            })
          )
          .min(1)
          .max(60),
        measure,
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Pick a recipe" }, 400);
    const lines = parsed.data.entries.flatMap((entry) => {
      const recipe = getRecipe(entry.recipeId, user.id, isAdmin(user));
      return recipe
        ? recipeLines(recipe, entry.servings, parsed.data.measure)
        : [];
    });
    if (lines.length === 0)
      return c.json({ error: "Those recipes have no ingredients" }, 400);
    mergeLines(user.id, lines);
    return c.json(listShopping(user.id));
  });

  api.patch("/shopping/:id", async (c) => {
    const parsed = itemPatch.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the item" }, 400);
    const patch = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(patch).length === 0)
      return c.json({ error: "Nothing to change" }, 400);
    const userId = c.get("user").id;
    if (!updateItem(userId, c.req.param("id"), patch))
      return c.json({ error: "Item not found" }, 404);
    return c.json(listShopping(userId));
  });

  api.delete("/shopping/:id", (c) => {
    const userId = c.get("user").id;
    if (!removeItem(userId, c.req.param("id")))
      return c.json({ error: "Item not found" }, 404);
    return c.json(listShopping(userId));
  });

  api.post("/shopping/clear", async (c) => {
    const parsed = z
      .object({ which: z.enum(["checked", "all"]) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Choose what to clear" }, 400);
    const userId = c.get("user").id;
    clearItems(userId, parsed.data.which);
    return c.json(listShopping(userId));
  });

  // Stores ----------------------------------------------------------------------

  const storeName = z.string().trim().min(1).max(60);

  api.get("/stores", (c) => c.json(listStores(c.get("user").id)));

  api.post("/stores", async (c) => {
    const parsed = z.object({ name: storeName }).safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Name the store" }, 400);
    const userId = c.get("user").id;
    if (listStores(userId).length >= 20)
      return c.json({ error: "You can save up to 20 stores" }, 400);
    const id = createStore(userId, parsed.data.name);
    return c.json({ id, stores: listStores(userId) }, 201);
  });

  api.patch("/stores/:id", async (c) => {
    const parsed = z
      .object({ name: storeName, layout: storeLayout })
      .partial()
      .strict()
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the store" }, 400);
    const userId = c.get("user").id;
    if (!updateStore(userId, c.req.param("id"), parsed.data))
      return c.json({ error: "Store not found" }, 404);
    return c.json(listStores(userId));
  });

  api.delete("/stores/:id", (c) => {
    const userId = c.get("user").id;
    if (!deleteStore(userId, c.req.param("id")))
      return c.json({ error: "Store not found" }, 404);
    return c.json(listStores(userId));
  });

  // Meal plan -----------------------------------------------------------------

  const dayRange = (from: string, to: string) => {
    const span =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000;
    return span >= 0 && span <= 62;
  };

  api.get("/plan", (c) => {
    const user = c.get("user");
    const from = isoDay.safeParse(c.req.query("from"));
    const to = isoDay.safeParse(c.req.query("to"));
    if (!from.success || !to.success || !dayRange(from.data, to.data))
      return c.json({ error: "Pick a range of up to two months" }, 400);
    return c.json(listPlan(user.id, from.data, to.data, isAdmin(user)));
  });

  api.post("/plan", async (c) => {
    const user = c.get("user");
    const parsed = z
      .object({
        day: isoDay,
        slot: z.enum(slots),
        recipeId: z.string(),
        servings: servings.default(null),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Pick a day and a recipe" }, 400);
    if (!viewable(parsed.data.recipeId, user.id, isAdmin(user)))
      return c.json({ error: "Recipe not found" }, 404);
    const id = addPlan(user.id, parsed.data);
    return c.json({ id }, 201);
  });

  api.patch("/plan/:id", async (c) => {
    const parsed = z
      .object({
        day: isoDay.optional(),
        slot: z.enum(slots).optional(),
        servings: servings.optional(),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the plan entry" }, 400);
    if (!updatePlan(c.get("user").id, c.req.param("id"), parsed.data))
      return c.json({ error: "Plan entry not found" }, 404);
    return c.json(null);
  });

  api.delete("/plan/:id", (c) => {
    if (!removePlan(c.get("user").id, c.req.param("id")))
      return c.json({ error: "Plan entry not found" }, 404);
    return c.json(null);
  });

  // Collections ---------------------------------------------------------------

  const collectionFields = {
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500),
  };
  const collectionInput = z.object({
    name: collectionFields.name,
    description: collectionFields.description.default(""),
  });
  const collectionPatch = z.object(collectionFields).partial().strict();

  api.get("/collections", (c) => {
    const user = c.get("user");
    return c.json(listCollections(user.id, isAdmin(user)));
  });

  api.post("/collections", async (c) => {
    const parsed = collectionInput.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Name the collection" }, 400);
    const id = createCollection(c.get("user").id, parsed.data);
    return c.json({ id }, 201);
  });

  api.get("/collections/:id", (c) => {
    const user = c.get("user");
    const collection = getCollection(user.id, c.req.param("id"), isAdmin(user));
    if (!collection) return c.json({ error: "Collection not found" }, 404);
    return c.json(collection);
  });

  api.patch("/collections/:id", async (c) => {
    const parsed = collectionPatch.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the name" }, 400);
    if (!updateCollection(c.get("user").id, c.req.param("id"), parsed.data))
      return c.json({ error: "Collection not found" }, 404);
    return c.json(null);
  });

  api.delete("/collections/:id", (c) => {
    if (!deleteCollection(c.get("user").id, c.req.param("id")))
      return c.json({ error: "Collection not found" }, 404);
    return c.json(null);
  });

  api.put("/collections/:id/recipes/:recipeId", (c) => {
    const user = c.get("user");
    const recipeId = c.req.param("recipeId");
    if (!viewable(recipeId, user.id, isAdmin(user)))
      return c.json({ error: "Recipe not found" }, 404);
    if (!addToCollection(user.id, c.req.param("id"), recipeId))
      return c.json({ error: "Collection not found" }, 404);
    return c.json(null);
  });

  api.delete("/collections/:id/recipes/:recipeId", (c) => {
    if (
      !removeFromCollection(
        c.get("user").id,
        c.req.param("id"),
        c.req.param("recipeId")
      )
    )
      return c.json({ error: "Collection not found" }, 404);
    return c.json(null);
  });

  api.get("/recipes/:id/collections", (c) =>
    c.json(collectionsForRecipe(c.get("user").id, c.req.param("id")))
  );

  // Importing files from other apps ---------------------------------------------

  api.post("/import/file", async (c) => {
    const user = c.get("user");
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "Choose a file" }, 400);
    if (file.size > maxImportBytes)
      return c.json({ error: "Files must be under 100MB" }, 400);
    const result = readImportFile(
      file.name,
      new Uint8Array(await file.arrayBuffer())
    );
    const imported: { id: string; title: string }[] = [];
    const skipped = [...result.skipped];
    for (const entry of result.recipes) {
      if (imported.length >= maxImportRecipes) {
        skipped.push(`${entry.recipe.title}: over the ${maxImportRecipes} recipe limit`);
        continue;
      }
      if (entry.image)
        entry.recipe.image = await saveUpload(entry.image.bytes, entry.image.extension);
      const saved = createRecipe(
        { ...entry.recipe, visibility: "private", favorite: false },
        user.id
      );
      if (saved) imported.push({ id: saved.id, title: saved.title });
      else skipped.push(`${entry.recipe.title}: could not save`);
    }
    return c.json({ imported, skipped: skipped.slice(0, 200) });
  });

  // Backups ---------------------------------------------------------------------

  api.get("/admin/backup", (c) => {
    if (!isAdmin(c.get("user")))
      return c.json({ error: "An admin has to do that" }, 403);
    const zip = createBackupZip();
    const day = new Date().toISOString().slice(0, 10);
    return new Response(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="mise-backup-${day}.zip"`,
        "cache-control": "no-store",
      },
    });
  });

  api.post("/admin/restore", async (c) => {
    const user = c.get("user");
    if (!isAdmin(user)) return c.json({ error: "An admin has to do that" }, 403);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "Choose a backup file" }, 400);
    const result = restoreBackup(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      user.id
    );
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json(result.summary);
  });

  // Claude ------------------------------------------------------------------------

  api.post("/ai/recipe", async (c) => {
    if (!aiEnabled()) return c.json({ error: "AI is not set up on this server" }, 400);
    const form = await c.req.formData().catch(() => null);
    if (!form) return c.json({ error: "Paste a recipe or add a photo" }, 400);
    const text = form.get("text");
    const file = form.get("image");
    const body = typeof text === "string" ? text.slice(0, 60_000) : "";
    let image: { data: string; mediaType: (typeof aiImageTypes)[number] } | null =
      null;
    if (file instanceof File && file.size > 0) {
      const mediaType = aiImageTypes.find((type) => type === file.type);
      if (!mediaType)
        return c.json({ error: "Use a JPEG, PNG, GIF, or WebP photo" }, 400);
      if (file.size > 5 * 1024 * 1024)
        return c.json({ error: "Photos must be under 5MB" }, 400);
      image = {
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType,
      };
    }
    if (!body.trim() && !image)
      return c.json({ error: "Paste a recipe or add a photo" }, 400);
    const result = await extractRecipe({ text: body, image });
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json({ ...result.value, visibility: "private" });
  });

  api.post("/ai/ask", async (c) => {
    const user = c.get("user");
    if (!aiEnabled()) return c.json({ error: "AI is not set up on this server" }, 400);
    const parsed = z
      .object({ recipeId: z.string(), question: z.string().trim().min(3).max(500) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Ask a short question" }, 400);
    const recipe = getRecipe(parsed.data.recipeId, user.id, isAdmin(user));
    if (!recipe) return c.json({ error: "Recipe not found" }, 404);
    const result = await askAboutRecipe(recipe, parsed.data.question);
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json({ answer: result.value });
  });
};
