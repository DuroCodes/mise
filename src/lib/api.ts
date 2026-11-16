import { z } from "zod";
import { zodFetch } from "@/lib/zod-fetch";
import {
  recipeInput,
  recipeSchema,
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
