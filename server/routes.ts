import { z } from "zod";
import { httpUrl, isoDay } from "../src/shared/recipe";
import {
  aiEnabled,
  aiImageTypes,
  askAboutRecipe,
  extractRecipe,
  findRecipes,
  readPantryPhoto,
  recipeFromUrl,
} from "./ai";
import {
  addToPantry,
  finishShopping,
  listPantry,
  missingFor,
  moveCheckedToPantry,
  pantrySuggestions,
  removePantryItem,
  updatePantryItem,
} from "./pantry";
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
import { createRecipe, getRecipe, viewable } from "./db";
import {
  maxImportBytes,
  maxImportRecipes,
  readImportFile,
} from "./import-file";
import { parseRecipeHtml } from "./recipe-page";
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
import { barcodeShape, lookupBarcode } from "./products";
import {
  allowedEndpoint,
  cancelTimer,
  hasSubscription,
  publicKey,
  removeSubscription,
  saveSubscription,
  scheduleTimer,
  sendToUser,
  subscriptionFor,
  updatePrefs,
} from "./push";
import { createStore, deleteStore, listStores, updateStore } from "./stores";
import { saveUpload } from "./uploads";
import { storeLayout } from "../src/shared/stores";
const measure = z.enum(["original", "metric", "imperial"]).default("original");
const servings = z.number().int().min(1).max(999).nullable();

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

  api.post("/recipes/:id/share", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!viewable(id, user.id, user.role === "admin"))
      return c.json({ error: "Recipe not found" }, 404);
    const token = createShare(id);
    if (!token) return c.json({ error: "Recipe not found" }, 404);
    return c.json({ token });
  });

  api.delete("/recipes/:id/share", (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    if (!viewable(id, user.id, user.role === "admin"))
      return c.json({ error: "Recipe not found" }, 404);
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

  // Pantry ----------------------------------------------------------------------

  const pantryFields = {
    name: z.string().trim().min(1).max(200),
    amount: z.string().trim().max(40),
    unit: z.string().trim().max(40),
    note: z.string().trim().max(200),
    expiresOn: isoDay.nullable(),
  };
  const pantryInput = z.object({
    name: pantryFields.name,
    amount: pantryFields.amount.default(""),
    unit: pantryFields.unit.default(""),
    note: pantryFields.note.default(""),
    expiresOn: pantryFields.expiresOn.default(null),
  });
  const pantryPatch = z.object(pantryFields).partial().strict();
  const todayParam = (raw: string | undefined) => {
    const parsed = isoDay.safeParse(raw);
    return parsed.success ? parsed.data : new Date().toISOString().slice(0, 10);
  };

  api.get("/pantry", (c) => c.json(listPantry(c.get("user").id)));

  api.post("/pantry", async (c) => {
    const parsed = pantryInput.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Name the item" }, 400);
    const userId = c.get("user").id;
    if (listPantry(userId).length >= 500)
      return c.json({ error: "Your pantry is full (500 items)" }, 400);
    addToPantry(userId, [parsed.data]);
    return c.json(listPantry(userId), 201);
  });

  api.patch("/pantry/:id", async (c) => {
    const parsed = pantryPatch.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the item" }, 400);
    const userId = c.get("user").id;
    if (!updatePantryItem(userId, c.req.param("id"), parsed.data))
      return c.json({ error: "Item not found" }, 404);
    return c.json(listPantry(userId));
  });

  api.delete("/pantry/:id", (c) => {
    const userId = c.get("user").id;
    if (!removePantryItem(userId, c.req.param("id")))
      return c.json({ error: "Item not found" }, 404);
    return c.json(listPantry(userId));
  });

  api.post("/pantry/batch", async (c) => {
    const parsed = z
      .object({ items: z.array(pantryInput).min(1).max(100) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the items" }, 400);
    const userId = c.get("user").id;
    if (listPantry(userId).length + parsed.data.items.length > 500)
      return c.json({ error: "Your pantry is full (500 items)" }, 400);
    addToPantry(userId, parsed.data.items);
    return c.json(listPantry(userId), 201);
  });

  api.post("/ai/pantry-photo", async (c) => {
    if (!aiEnabled())
      return c.json({ error: "AI is not set up on this server" }, 400);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("image");
    const kind = form?.get("kind") === "fridge" ? "fridge" : "receipt";
    if (!(file instanceof File) || file.size === 0)
      return c.json({ error: "Take a photo first" }, 400);
    const mediaType = aiImageTypes.find((type) => type === file.type);
    if (!mediaType)
      return c.json({ error: "Use a JPEG, PNG, GIF, or WebP photo" }, 400);
    if (file.size > 5 * 1024 * 1024)
      return c.json({ error: "Photos must be under 5MB" }, 400);
    const result = await readPantryPhoto({
      image: {
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType,
      },
      kind,
    });
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json(result.value);
  });

  api.post("/pantry/from-shopping", (c) => {
    const userId = c.get("user").id;
    const moved = moveCheckedToPantry(userId);
    return c.json({
      moved,
      pantry: listPantry(userId),
      shopping: listShopping(userId),
    });
  });

  api.post("/shopping/done", async (c) => {
    const parsed = z
      .object({
        keep: z
          .array(
            z.object({
              id: z.string(),
              amount: z.string().trim().max(40),
              unit: z.string().trim().max(40),
            })
          )
          .max(500),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the amounts" }, 400);
    const userId = c.get("user").id;
    const result = finishShopping(userId, parsed.data.keep);
    return c.json({
      ...result,
      shopping: listShopping(userId),
      pantry: listPantry(userId),
    });
  });

  api.get("/products/:code", async (c) => {
    const code = c.req.param("code");
    if (!barcodeShape.test(code))
      return c.json({ error: "That isn't a barcode" }, 400);
    const result = await lookupBarcode(code);
    if (!result.ok)
      return c.json({ error: "Couldn't look that up right now" }, 502);
    if (!result.product) return c.json({ error: "Product not found" }, 404);
    return c.json(result.product);
  });

  // Push notifications --------------------------------------------------------------

  const endpointInput = z
    .string()
    .max(1000)
    .refine(allowedEndpoint, "Unsupported push service");
  const prefsInput = z.object({ useSoon: z.boolean(), tomorrow: z.boolean() });

  api.get("/push/key", (c) => c.json({ publicKey }));

  api.post("/push/status", async (c) => {
    const parsed = z
      .object({ endpoint: z.string().max(1000) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "Check the subscription" }, 400);
    return c.json({
      prefs: subscriptionFor(c.get("user").id, parsed.data.endpoint),
    });
  });

  api.post("/push/subscribe", async (c) => {
    const parsed = z
      .object({
        endpoint: endpointInput,
        keys: z.object({
          p256dh: z.string().min(1).max(200),
          auth: z.string().min(1).max(100),
        }),
      })
      .extend(prefsInput.shape)
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json(
        { error: "This browser's push service isn't supported" },
        400
      );
    const { endpoint, keys: subscriptionKeys, useSoon, tomorrow } = parsed.data;
    saveSubscription(c.get("user").id, {
      endpoint,
      ...subscriptionKeys,
      useSoon,
      tomorrow,
    });
    return c.json({ prefs: { useSoon, tomorrow } }, 201);
  });

  api.patch("/push/subscribe", async (c) => {
    const parsed = z
      .object({ endpoint: z.string().max(1000) })
      .extend(prefsInput.partial().shape)
      .strict()
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the settings" }, 400);
    const { endpoint, ...prefs } = parsed.data;
    const userId = c.get("user").id;
    if (!updatePrefs(userId, endpoint, prefs))
      return c.json({ error: "Notifications aren't on for this device" }, 404);
    return c.json({ prefs: subscriptionFor(userId, endpoint) });
  });

  api.delete("/push/subscribe", async (c) => {
    const parsed = z
      .object({ endpoint: z.string().max(1000) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "Check the subscription" }, 400);
    removeSubscription(c.get("user").id, parsed.data.endpoint);
    return c.json(null);
  });

  api.post("/push/test", async (c) => {
    const sent = await sendToUser(c.get("user").id, {
      title: "Notifications are on",
      body: "This is what they'll look like.",
      url: "/settings",
      tag: "test",
      kind: "test",
    });
    if (sent === 0) return c.json({ error: "Couldn't reach this device" }, 502);
    return c.json({ sent });
  });

  api.post("/push/timers", async (c) => {
    const parsed = z
      .object({
        id: z.string().min(1).max(64),
        label: z.string().trim().min(1).max(120),
        recipe: z.string().trim().max(200).default(""),
        seconds: z.number().min(1).max(86_400),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Check the timer" }, 400);
    const userId = c.get("user").id;
    if (!hasSubscription(userId)) return c.json({ scheduled: false });
    if (
      !scheduleTimer(userId, {
        ...parsed.data,
        seconds: Math.round(parsed.data.seconds),
      })
    )
      return c.json({ error: "Too many timers" }, 400);
    return c.json({ scheduled: true });
  });

  api.delete("/push/timers/:id", (c) => {
    cancelTimer(c.get("user").id, c.req.param("id"));
    return c.json(null);
  });

  api.get("/pantry/suggestions", (c) =>
    c.json(
      pantrySuggestions(c.get("user").id, todayParam(c.req.query("today")))
    )
  );

  api.post("/shopping/missing", async (c) => {
    const user = c.get("user");
    const parsed = z
      .object({ recipeId: z.string(), measure })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Pick a recipe" }, 400);
    const recipe = getRecipe(parsed.data.recipeId, user.id, isAdmin(user));
    if (!recipe) return c.json({ error: "Recipe not found" }, 404);
    const missing = missingFor(user.id, recipe);
    const lines = recipeLines(
      recipe,
      recipe.servings,
      parsed.data.measure
    ).filter((_, index) => missing.has(recipe.ingredients[index]?.name ?? ""));
    if (lines.length === 0)
      return c.json({ error: "You already have everything for this one" }, 400);
    mergeLines(user.id, lines);
    return c.json({ added: lines.length, shopping: listShopping(user.id) });
  });

  api.post("/ai/find-recipes", async (c) => {
    if (!aiEnabled())
      return c.json({ error: "AI is not set up on this server" }, 400);
    const parsed = z
      .object({ focus: z.string().trim().max(200).default("") })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "Keep the request short" }, 400);
    const pantry = listPantry(c.get("user").id).map((item) => item.name);
    if (pantry.length === 0 && !parsed.data.focus)
      return c.json({ error: "Add a few things to your pantry first" }, 400);
    const result = await findRecipes(pantry, parsed.data.focus);
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json(result.value);
  });

  // Stores ----------------------------------------------------------------------

  const storeName = z.string().trim().min(1).max(60);

  api.get("/stores", (c) => c.json(listStores(c.get("user").id)));

  api.post("/stores", async (c) => {
    const parsed = z
      .object({ name: storeName })
      .safeParse(await readJson(c.req.raw));
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
    if (!parsed.success)
      return c.json({ error: "Pick a day and a recipe" }, 400);
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

  // A page sent from the person's own browser by the "Send to Mise" button.
  api.post("/import/page", async (c) => {
    const parsed = z
      .object({ url: httpUrl, html: z.string().min(1).max(5_000_000) })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "That page couldn't be sent" }, 400);
    const result = parseRecipeHtml(parsed.data.html);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json({
      ...result.recipe,
      sourceUrl: parsed.data.url,
      visibility: "private",
    });
  });

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
    // Nothing is saved until the person confirms. One recipe is handed back
    // to the form; a batch is only listed until they ask to add it.
    if (form?.get("commit") !== "1") {
      const titles = result.recipes.map((entry) => entry.recipe.title);
      const only = result.recipes.length === 1 ? result.recipes[0] : null;
      if (only?.image)
        only.recipe.image = await saveUpload(
          only.image.bytes,
          only.image.extension
        );
      return c.json({
        recipe: only?.recipe ?? null,
        titles,
        skipped: result.skipped.slice(0, 200),
      });
    }
    const imported: { id: string; title: string }[] = [];
    const skipped = [...result.skipped];
    for (const entry of result.recipes) {
      if (imported.length >= maxImportRecipes) {
        skipped.push(
          `${entry.recipe.title}: over the ${maxImportRecipes} recipe limit`
        );
        continue;
      }
      if (entry.image)
        entry.recipe.image = await saveUpload(
          entry.image.bytes,
          entry.image.extension
        );
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
    if (!isAdmin(user))
      return c.json({ error: "An admin has to do that" }, 403);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File))
      return c.json({ error: "Choose a backup file" }, 400);
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
    if (!aiEnabled())
      return c.json({ error: "AI is not set up on this server" }, 400);
    const form = await c.req.formData().catch(() => null);
    if (!form) return c.json({ error: "Paste a recipe or add a photo" }, 400);
    const text = form.get("text");
    const file = form.get("image");
    const body = typeof text === "string" ? text.slice(0, 60_000) : "";
    let image: {
      data: string;
      mediaType: (typeof aiImageTypes)[number];
    } | null = null;
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

  api.post("/ai/recipe-from-url", async (c) => {
    if (!aiEnabled())
      return c.json({ error: "AI is not set up on this server" }, 400);
    const parsed = z
      .object({ url: httpUrl })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success)
      return c.json({ error: "Paste a public http(s) recipe link" }, 400);
    const result = await recipeFromUrl(parsed.data.url);
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json({ ...result.value, visibility: "private" });
  });

  api.post("/ai/ask", async (c) => {
    const user = c.get("user");
    if (!aiEnabled())
      return c.json({ error: "AI is not set up on this server" }, 400);
    const parsed = z
      .object({
        recipeId: z.string(),
        question: z.string().trim().min(3).max(500),
      })
      .safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: "Ask a short question" }, 400);
    const recipe = getRecipe(parsed.data.recipeId, user.id, isAdmin(user));
    if (!recipe) return c.json({ error: "Recipe not found" }, 404);
    const result = await askAboutRecipe(recipe, parsed.data.question);
    if (!result.ok) return c.json({ error: result.error }, 502);
    return c.json({ answer: result.value });
  });
};
