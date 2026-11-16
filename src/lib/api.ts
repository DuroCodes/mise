import { z } from "zod";
import { zodFetch } from "@/lib/zod-fetch";
import type { Measure } from "@/lib/units";
import {
  ratingSummary,
  recipeInput,
  recipeSchema,
  sharedRecipeSchema,
  type Recipe,
  type RecipeInput,
} from "@/shared/recipe";

const byId = new Map<string, Recipe>();

export const cachedRecipe = (id: string) => byId.get(id) ?? null;

const keep = (recipe: Recipe) => {
  byId.set(recipe.id, recipe);
};

const json = (body: unknown) => ({
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const favoriteSchema = z.object({ favorite: z.boolean() });
const uploadSchema = z.object({ url: z.string() });

export const listRecipes = async () => {
  const result = await zodFetch(
    z.array(recipeSchema),
    "Could not load recipes",
    "/api/recipes"
  );
  if (result.ok) {
    byId.clear();
    for (const recipe of result.value) keep(recipe);
  }
  return result;
};

export const listTags = () =>
  zodFetch(z.array(z.string()), "Could not load tags", "/api/tags");

export const getRecipe = async (id: string) => {
  const result = await zodFetch(
    recipeSchema,
    "Could not load recipe",
    `/api/recipes/${id}`
  );
  if (result.ok) keep(result.value);
  else if (result.error === "Recipe not found") byId.delete(id);
  return result;
};

export const createRecipe = async (input: RecipeInput) => {
  const result = await zodFetch(
    recipeSchema,
    "Could not save recipe",
    "/api/recipes",
    { method: "POST", ...json(input) }
  );
  if (result.ok) keep(result.value);
  return result;
};

export const updateRecipe = async (id: string, input: RecipeInput) => {
  const result = await zodFetch(
    recipeSchema,
    "Could not save recipe",
    `/api/recipes/${id}`,
    { method: "PATCH", ...json(input) }
  );
  if (result.ok) keep(result.value);
  return result;
};

export const removeRecipe = async (id: string) => {
  const result = await zodFetch(
    z.null(),
    "Could not delete recipe",
    `/api/recipes/${id}`,
    { method: "DELETE" }
  );
  if (result.ok) byId.delete(id);
  return result;
};

export const setFavorite = async (id: string) => {
  const result = await zodFetch(
    favoriteSchema,
    "Could not update favorite",
    `/api/recipes/${id}/favorite`,
    { method: "POST" }
  );
  if (result.ok) {
    const current = byId.get(id);
    if (current) keep({ ...current, favorite: result.value.favorite });
  }
  return result;
};

const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

export type Account = z.infer<typeof accountSchema>;

export const setupNeeded = () =>
  zodFetch(
    z.object({ needed: z.boolean() }),
    "Could not check setup",
    "/api/setup"
  );

export const currentAccount = () =>
  zodFetch(accountSchema, "Could not load account", "/api/me");

const adminRecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  visibility: z.enum(["private", "public"]),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
});

export type AdminRecipe = z.infer<typeof adminRecipeSchema>;

export const listPeople = () =>
  zodFetch(z.array(accountSchema), "Could not load accounts", "/api/users");

export const listAdminRecipes = () =>
  zodFetch(
    z.array(adminRecipeSchema),
    "Could not load recipes",
    "/api/admin/recipes"
  );

export const addPerson = (input: {
  name: string;
  email: string;
  password: string;
}) =>
  zodFetch(z.array(accountSchema), "Could not add that account", "/api/users", {
    method: "POST",
    ...json(input),
  });

export const removePerson = (id: string) =>
  zodFetch(z.null(), "Could not remove that account", `/api/users/${id}`, {
    method: "DELETE",
  });

export const updatePerson = (
  id: string,
  input: { role?: "admin" | "member"; password?: string }
) =>
  zodFetch(
    z.array(accountSchema),
    "Could not update that account",
    `/api/users/${id}`,
    { method: "PATCH", ...json(input) }
  );

export const importRecipe = (url: string) =>
  zodFetch(recipeInput, "Could not import that recipe", "/api/import", {
    method: "POST",
    ...json({ url }),
  });

export const uploadImage = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return zodFetch(uploadSchema, "Could not upload image", "/api/uploads", {
    method: "POST",
    body,
  });
};

export const discardUpload = (url: string) =>
  zodFetch(z.null(), "Could not remove image", "/api/uploads", {
    method: "DELETE",
    ...json({ url }),
  });

// Features ----------------------------------------------------------------

export const getFeatures = () =>
  zodFetch(
    z.object({ ai: z.boolean() }),
    "Could not load settings",
    "/api/features"
  );

// Ratings and cooking log ---------------------------------------------------

export const rateRecipe = async (id: string, stars: number | null) => {
  const result = await zodFetch(
    ratingSummary,
    "Could not save the rating",
    `/api/recipes/${id}/rating`,
    { method: "POST", ...json({ stars }) }
  );
  if (result.ok) {
    const current = byId.get(id);
    if (current) keep({ ...current, rating: result.value });
  }
  return result;
};

const cookLogSchema = z.object({
  id: z.string(),
  cookedOn: z.string(),
  note: z.string(),
  userId: z.string(),
  userName: z.string(),
});

export type CookLog = z.infer<typeof cookLogSchema>;

export const listCookLogs = (id: string) =>
  zodFetch(
    z.array(cookLogSchema),
    "Could not load the cooking log",
    `/api/recipes/${id}/logs`
  );

export const addCookLog = (
  id: string,
  input: { cookedOn: string; note: string }
) =>
  zodFetch(
    z.array(cookLogSchema),
    "Could not save that",
    `/api/recipes/${id}/logs`,
    { method: "POST", ...json(input) }
  );

export const removeCookLog = (id: string) =>
  zodFetch(z.null(), "Could not remove that entry", `/api/logs/${id}`, {
    method: "DELETE",
  });

// Share links ---------------------------------------------------------------

export const createShareLink = (id: string) =>
  zodFetch(
    z.object({ token: z.string() }),
    "Could not create a link",
    `/api/recipes/${id}/share`,
    { method: "POST" }
  );

export const removeShareLink = (id: string) =>
  zodFetch(
    z.null(),
    "Could not turn off the link",
    `/api/recipes/${id}/share`,
    { method: "DELETE" }
  );

export const getSharedRecipe = (token: string) =>
  zodFetch(
    sharedRecipeSchema,
    "This link no longer works",
    `/api/share/${encodeURIComponent(token)}`
  );

// Shopping list ---------------------------------------------------------------

const shoppingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.string(),
  unit: z.string(),
  note: z.string(),
  sources: z.array(z.string()),
  checked: z.boolean(),
});

export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
const shoppingList = z.array(shoppingItemSchema);

export const listShopping = () =>
  zodFetch(shoppingList, "Could not load the shopping list", "/api/shopping");

export const addShoppingItem = (input: {
  name: string;
  amount?: string;
  unit?: string;
  note?: string;
}) =>
  zodFetch(shoppingList, "Could not add that", "/api/shopping", {
    method: "POST",
    ...json(input),
  });

export const addRecipesToShopping = (
  entries: { recipeId: string; servings: number | null }[],
  measure: Measure
) =>
  zodFetch(
    shoppingList,
    "Could not add to the shopping list",
    "/api/shopping/recipes",
    { method: "POST", ...json({ entries, measure }) }
  );

export const updateShoppingItem = (
  id: string,
  patch: Partial<
    Pick<ShoppingItem, "name" | "amount" | "unit" | "note" | "checked">
  >
) =>
  zodFetch(shoppingList, "Could not update that", `/api/shopping/${id}`, {
    method: "PATCH",
    ...json(patch),
  });

export const removeShoppingItem = (id: string) =>
  zodFetch(shoppingList, "Could not remove that", `/api/shopping/${id}`, {
    method: "DELETE",
  });

export const clearShopping = (which: "checked" | "all") =>
  zodFetch(shoppingList, "Could not clear the list", "/api/shopping/clear", {
    method: "POST",
    ...json({ which }),
  });

// Meal plan -----------------------------------------------------------------

export const mealSlots = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof mealSlots)[number];

export const slotLabel: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const planEntrySchema = z.object({
  id: z.string(),
  day: z.string(),
  slot: z.enum(mealSlots),
  position: z.number(),
  servings: z.number().nullable(),
  recipeId: z.string(),
  title: z.string(),
  image: z.string().nullable(),
  recipeServings: z.number().nullable(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
});

export type PlanEntry = z.infer<typeof planEntrySchema>;

export const listPlan = (from: string, to: string) =>
  zodFetch(
    z.array(planEntrySchema),
    "Could not load the meal plan",
    `/api/plan?from=${from}&to=${to}`
  );

export const addPlanEntry = (input: {
  day: string;
  slot: MealSlot;
  recipeId: string;
  servings: number | null;
}) =>
  zodFetch(z.object({ id: z.string() }), "Could not add that", "/api/plan", {
    method: "POST",
    ...json(input),
  });

export const updatePlanEntry = (
  id: string,
  patch: { day?: string; slot?: MealSlot; servings?: number | null }
) =>
  zodFetch(z.null(), "Could not move that", `/api/plan/${id}`, {
    method: "PATCH",
    ...json(patch),
  });

export const removePlanEntry = (id: string) =>
  zodFetch(z.null(), "Could not remove that", `/api/plan/${id}`, {
    method: "DELETE",
  });

// Collections ---------------------------------------------------------------

const collectionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  count: z.number(),
  images: z.array(z.string()),
});

export type CollectionSummary = z.infer<typeof collectionSummarySchema>;

const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  recipes: z.array(recipeSchema),
});

export type Collection = z.infer<typeof collectionSchema>;

export const listCollections = () =>
  zodFetch(
    z.array(collectionSummarySchema),
    "Could not load collections",
    "/api/collections"
  );

export const getCollection = (id: string) =>
  zodFetch(
    collectionSchema,
    "Could not load that collection",
    `/api/collections/${id}`
  );

export const createCollection = (input: {
  name: string;
  description: string;
}) =>
  zodFetch(
    z.object({ id: z.string() }),
    "Could not create that",
    "/api/collections",
    { method: "POST", ...json(input) }
  );

export const updateCollection = (
  id: string,
  input: { name?: string; description?: string }
) =>
  zodFetch(z.null(), "Could not save that", `/api/collections/${id}`, {
    method: "PATCH",
    ...json(input),
  });

export const deleteCollection = (id: string) =>
  zodFetch(z.null(), "Could not delete that", `/api/collections/${id}`, {
    method: "DELETE",
  });

export const addToCollection = (collectionId: string, recipeId: string) =>
  zodFetch(
    z.null(),
    "Could not add to the collection",
    `/api/collections/${collectionId}/recipes/${recipeId}`,
    { method: "PUT" }
  );

export const removeFromCollection = (collectionId: string, recipeId: string) =>
  zodFetch(
    z.null(),
    "Could not remove from the collection",
    `/api/collections/${collectionId}/recipes/${recipeId}`,
    { method: "DELETE" }
  );

export const recipeCollections = (recipeId: string) =>
  zodFetch(
    z.array(z.string()),
    "Could not load collections",
    `/api/recipes/${recipeId}/collections`
  );

// Importing files and backups ---------------------------------------------------

const importResultSchema = z.object({
  imported: z.array(z.object({ id: z.string(), title: z.string() })),
  skipped: z.array(z.string()),
});

export type ImportResult = z.infer<typeof importResultSchema>;

export const importFile = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return zodFetch(
    importResultSchema,
    "Could not import that file",
    "/api/import/file",
    { method: "POST", body }
  );
};

const restoreSummarySchema = z.object({
  recipes: z.number(),
  images: z.number(),
  ratings: z.number(),
  cookLogs: z.number(),
  collections: z.number(),
  mealPlan: z.number(),
  shopping: z.number(),
  skipped: z.number(),
});

export type RestoreSummary = z.infer<typeof restoreSummarySchema>;

export const restoreBackup = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return zodFetch(
    restoreSummarySchema,
    "Could not restore that backup",
    "/api/admin/restore",
    { method: "POST", body }
  );
};

// Invite links ------------------------------------------------------------------

const inviteSchema = z.object({
  id: z.string(),
  token: z.string(),
  note: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  usedBy: z.object({ name: z.string(), email: z.string() }).nullable(),
});

export type Invite = z.infer<typeof inviteSchema>;

export const listInvites = () =>
  zodFetch(z.array(inviteSchema), "Could not load invites", "/api/invites");

export const createInvite = (input: { note: string; days: 1 | 7 | 30 }) =>
  zodFetch(z.array(inviteSchema), "Could not create the invite", "/api/invites", {
    method: "POST",
    ...json(input),
  });

export const revokeInvite = (id: string) =>
  zodFetch(z.array(inviteSchema), "Could not revoke the invite", `/api/invites/${id}`, {
    method: "DELETE",
  });

export const describeInvite = (token: string) =>
  zodFetch(
    z.object({ inviterName: z.string().nullable(), expiresAt: z.string() }),
    "This invite link has expired or was already used",
    `/api/invite/${encodeURIComponent(token)}`
  );

export const acceptInvite = (
  token: string,
  input: { name: string; email: string; password: string }
) =>
  zodFetch(z.null(), "Could not create the account", `/api/invite/${encodeURIComponent(token)}`, {
    method: "POST",
    ...json(input),
  });

// Claude ----------------------------------------------------------------------

export const aiRecipe = (text: string, image: File | null) => {
  const body = new FormData();
  body.append("text", text);
  if (image) body.append("image", image);
  return zodFetch(recipeInput, "Could not read that recipe", "/api/ai/recipe", {
    method: "POST",
    body,
  });
};

export const askClaude = (recipeId: string, question: string) =>
  zodFetch(
    z.object({ answer: z.string() }),
    "Could not get an answer",
    "/api/ai/ask",
    { method: "POST", ...json({ recipeId, question }) }
  );
