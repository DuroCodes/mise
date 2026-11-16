import { z } from "zod";
import { Hono } from "hono";
import { serveStatic } from "@hono/bun";
import { recipeInput } from "../src/shared/recipe";
import { auth, sessionUser, withSignup, type SessionUser } from "./auth";
import {
  countUsers,
  createRecipe,
  deleteRecipe,
  getRecipe,
  listAllRecipes,
  listRecipes,
  listTags,
  listUsers,
  emailTaken,
  removeUpload,
  removeUser,
  setUserPassword,
  setUserRole,
  toggleFavorite,
  updateRecipe,
  uploadDir,
  uploadInUse,
  dataDir,
} from "./db";
import { importRecipeFromUrl } from "./fetch-recipe";
import { seedIfEmpty } from "./seed";

seedIfEmpty();

const app = new Hono();
const production = process.env.NODE_ENV === "production";

const accountInput = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
});

const readJson = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const api = new Hono<{ Variables: { user: SessionUser } }>();

api.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/api/health" || path === "/api/setup") return next();
  const current = await sessionUser(c.req.raw.headers);
  if (!current) return c.json({ error: "Sign in first" }, 401);
  c.set("user", current);
  return next();
});

api.get("/health", (c) => c.json({ ok: true }));

api.get("/setup", (c) => c.json({ needed: countUsers() === 0 }));

api.get("/me", (c) => c.json(c.get("user")));

api.get("/recipes", (c) => c.json(listRecipes(c.get("user").id)));

api.get("/tags", (c) => c.json(listTags(c.get("user").id)));

api.get("/recipes/:id", (c) => {
  const user = c.get("user");
  const recipe = getRecipe(c.req.param("id"), user.id, user.role === "admin");
  if (!recipe) return c.json({ error: "Recipe not found" }, 404);
  return c.json(recipe);
});

api.post("/recipes", async (c) => {
  const parsed = recipeInput.safeParse(await readJson(c.req.raw));
  if (!parsed.success)
    return c.json({ error: "Check the form and try again" }, 400);
  const recipe = createRecipe(parsed.data, c.get("user").id);
  if (!recipe) return c.json({ error: "Could not save recipe" }, 500);
  return c.json(recipe, 201);
});

api.patch("/recipes/:id", async (c) => {
  const parsed = recipeInput.safeParse(await readJson(c.req.raw));
  if (!parsed.success)
    return c.json({ error: "Check the form and try again" }, 400);
  const user = c.get("user");
  const recipe = updateRecipe(
    c.req.param("id"),
    parsed.data,
    user.id,
    user.role === "admin"
  );
  if (!recipe) return c.json({ error: "Recipe not found" }, 404);
  return c.json(recipe);
});

api.delete("/recipes/:id", (c) => {
  const user = c.get("user");
  if (!deleteRecipe(c.req.param("id"), user.id, user.role === "admin"))
    return c.json({ error: "Recipe not found" }, 404);
  return c.json(null);
});

api.get("/admin/recipes", (c) => {
  if (c.get("user").role !== "admin")
    return c.json({ error: "An admin has to do that" }, 403);
  return c.json(listAllRecipes());
});

api.post("/import", async (c) => {
  const body = (await readJson(c.req.raw)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const imported = await importRecipeFromUrl(url);
  if (!imported.ok) return c.json({ error: imported.error }, imported.status);
  return c.json({ ...imported.recipe, visibility: "private" });
});

api.get("/users", (c) => {
  if (c.get("user").role !== "admin")
    return c.json({ error: "An admin has to do that" }, 403);
  return c.json(listUsers());
});

api.post("/users", async (c) => {
  if (c.get("user").role !== "admin")
    return c.json({ error: "An admin has to do that" }, 403);
  const parsed = accountInput.safeParse(await readJson(c.req.raw));
  if (!parsed.success)
    return c.json(
      { error: "Use a name, email, and a password of at least 8 characters" },
      400
    );
  if (emailTaken(parsed.data.email))
    return c.json({ error: "That email is already taken" }, 400);
  try {
    await withSignup(() =>
      auth.api.signUpEmail({
        body: parsed.data,
      })
    );
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "body" in error &&
      error.body &&
      typeof error.body === "object" &&
      "code" in error.body
        ? String(error.body.code)
        : "";
    if (code.includes("USER_ALREADY_EXISTS"))
      return c.json({ error: "That email is already taken" }, 400);
    return c.json({ error: "Could not add that account" }, 400);
  }
  return c.json(listUsers(), 201);
});

api.patch("/users/:id", async (c) => {
  if (c.get("user").role !== "admin")
    return c.json({ error: "An admin has to do that" }, 403);
  const parsed = z
    .object({
      role: z.enum(["admin", "member"]).optional(),
      password: z.string().min(8).max(128).optional(),
    })
    .refine((value) => value.role !== undefined || value.password !== undefined)
    .safeParse(await readJson(c.req.raw));
  if (!parsed.success)
    return c.json(
      { error: "Check the role and use a password of at least 8 characters" },
      400
    );
  const id = c.req.param("id");
  if (parsed.data.role) {
    if (id === c.get("user").id && parsed.data.role !== c.get("user").role)
      return c.json({ error: "You cannot change your own role" }, 400);
    const result = setUserRole(id, parsed.data.role);
    if (result === "missing")
      return c.json({ error: "That person is not here" }, 404);
    if (result === "last-admin")
      return c.json({ error: "Keep at least one admin" }, 400);
  }
  if (parsed.data.password) {
    const result = await setUserPassword(
      id,
      parsed.data.password,
      id === c.get("user").id
    );
    if (result === "missing")
      return c.json({ error: "That person is not here" }, 404);
  }
  return c.json(listUsers());
});

api.delete("/users/:id", (c) => {
  if (c.get("user").role !== "admin")
    return c.json({ error: "An admin has to do that" }, 403);
  if (c.req.param("id") === c.get("user").id)
    return c.json({ error: "You cannot remove your own account" }, 400);
  const result = removeUser(c.req.param("id"));
  if (result === "missing")
    return c.json({ error: "That person is not here" }, 404);
  if (result === "last-admin")
    return c.json({ error: "Keep at least one admin" }, 400);
  return c.json(null);
});

api.post("/recipes/:id/favorite", (c) => {
  const result = toggleFavorite(c.req.param("id"), c.get("user").id);
  if (!result) return c.json({ error: "Recipe not found" }, 404);
  return c.json(result);
});

api.post("/uploads", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Choose an image" }, 400);
  if (!file.type.startsWith("image/"))
    return c.json({ error: "That file is not an image" }, 400);
  if (file.size > 8 * 1024 * 1024)
    return c.json({ error: "Image must be under 8MB" }, 400);

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : file.type === "image/avif"
            ? "avif"
            : "jpg";

  const name = `${crypto.randomUUID()}.${extension}`;
  await Bun.write(`${uploadDir}/${name}`, file);
  return c.json({ url: `/uploads/${name}` }, 201);
});

api.delete("/uploads", async (c) => {
  const body = (await readJson(c.req.raw)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.startsWith("/uploads/"))
    return c.json({ error: "Unknown file" }, 400);
  if (uploadInUse(url))
    return c.json({ error: "That image is still used" }, 409);
  removeUpload(url);
  return c.json(null);
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api", api);
app.use("/uploads/*", serveStatic({ root: dataDir }));

if (production) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT ?? (production ? 3000 : 3001));

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
