import { Gunzip, strFromU8, unzipSync, type Unzipped } from "fflate";
import { formatAmount } from "../src/lib/units";
import {
  recipeInput,
  type Ingredient,
  type RecipeInput,
} from "../src/shared/recipe";
import {
  collectRecipes,
  minutesOf,
  parseIngredientLine,
  parseRecipeHtml,
  recipeFromJsonLd,
} from "./recipe-page";

export type ImportedImage = { bytes: Uint8Array; extension: string };
export type ImportedRecipe = {
  recipe: RecipeInput;
  image: ImportedImage | null;
};
export type ImportResult = { recipes: ImportedRecipe[]; skipped: string[] };

export const maxImportRecipes = 500;
export const maxImportBytes = 100 * 1024 * 1024;
const maxUnpacked = 300 * 1024 * 1024;
const maxGzipEntry = 40 * 1024 * 1024;

/**
 * inflates gzip data but stops once the output passes `max`, so a small
 * compressed file can't expand into gigabytes and exhaust memory.
 */
export const gunzipLimited = (data: Uint8Array, max = maxGzipEntry) => {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflow = false;
  const stream = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > max) overflow = true;
    else chunks.push(chunk);
  });
  const step = 16 * 1024;
  for (let start = 0; start < data.length && !overflow; start += step) {
    const end = Math.min(start + step, data.length);
    stream.push(data.subarray(start, end), end === data.length);
  }
  if (overflow) throw new Error("Unpacked data is too large");
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const multiline = (value: unknown) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";

const clip = (value: string, max: number) => value.trim().slice(0, max);

/** reads "15 minutes", "1 hr 10 min", "1:30", or ISO 8601 "PT15M". */
export const minutesFromText = (value: unknown) => {
  const iso = minutesOf(value);
  if (iso !== null) return iso;
  if (typeof value !== "string") return null;
  const raw = value.toLowerCase().trim();
  if (!raw) return null;
  const clock = raw.match(/^(\d+):(\d{2})$/);
  if (clock) {
    const total = Number(clock[1]) * 60 + Number(clock[2]);
    return total <= 1440 ? total : null;
  }
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const minutes = raw.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (!hours && !minutes) return null;
  const total = Math.round(
    Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0)
  );
  return total >= 0 && total <= 1440 ? total : null;
};

const servingsFromText = (value: unknown) => {
  const raw = typeof value === "number" ? String(value) : text(value);
  const match = raw.match(/\d+/);
  if (!match) return null;
  const servings = Number(match[0]);
  return servings >= 1 && servings <= 999 ? servings : null;
};

const httpUrl = (value: unknown) => {
  const raw = text(value);
  if (!/^https?:\/\//i.test(raw) || raw.length > 2000) return null;
  try {
    new URL(raw);
    return raw;
  } catch {
    return null;
  }
};

const nameOf = (value: unknown) => {
  if (typeof value === "string") return text(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record.name) || text(record.abbreviation);
  }
  return "";
};

const namesOf = (value: unknown) =>
  Array.isArray(value) ? value.map(nameOf).filter(Boolean) : [];

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const finish = (draft: Record<string, unknown>) => {
  const parsed = recipeInput.safeParse({ ...draft, visibility: "private" });
  if (
    !parsed.success ||
    (!parsed.data.ingredients.length && !parsed.data.instructions.length)
  )
    return null;
  return parsed.data;
};

const cleanTags = (tags: string[]) =>
  tags
    .map((tag) => clip(tag, 40))
    .filter(Boolean)
    .slice(0, 20);

const ingredientsFromLines = (raw: string[]) =>
  raw
    .map(parseIngredientLine)
    .filter((item): item is Ingredient => Boolean(item))
    .slice(0, 80);

const stepsFromLines = (raw: string[]) =>
  raw
    .map((line) => clip(line.replace(/^\d+[.)]\s+/, ""), 2000))
    .filter(Boolean)
    .slice(0, 80)
    .map((step) => ({ text: step }));

const isPaprika = (value: Record<string, unknown>) =>
  typeof value.name === "string" &&
  (typeof value.ingredients === "string" ||
    typeof value.directions === "string");

const fromPaprika = (value: Record<string, unknown>) => {
  const description = [text(value.description), text(value.notes)]
    .filter(Boolean)
    .join("\n\n");
  const recipe = finish({
    title: clip(text(value.name), 200),
    description: clip(description, 4000),
    sourceUrl: httpUrl(value.source_url),
    image: httpUrl(value.image_url),
    prepMinutes: minutesFromText(value.prep_time),
    cookMinutes:
      minutesFromText(value.cook_time) ??
      (minutesFromText(value.prep_time) === null
        ? minutesFromText(value.total_time)
        : null),
    servings: servingsFromText(value.servings),
    tags: cleanTags(namesOf(value.categories)),
    ingredients: ingredientsFromLines(lines(multiline(value.ingredients))),
    instructions: stepsFromLines(lines(multiline(value.directions))),
  });
  if (!recipe) return null;
  let image: ImportedImage | null = null;
  if (typeof value.photo_data === "string" && value.photo_data) {
    try {
      const bytes = Uint8Array.from(Buffer.from(value.photo_data, "base64"));
      const extension = sniffImage(bytes);
      if (extension) {
        image = { bytes, extension };
        recipe.image = null;
      }
    } catch {
      image = null;
    }
  }
  return { recipe, image };
};

const isMealie = (value: Record<string, unknown>) =>
  typeof value.name === "string" &&
  Array.isArray(value.recipeIngredient) &&
  ("slug" in value || "recipeYield" in value || "orgURL" in value) &&
  !("@type" in value);

const mealieIngredient = (raw: unknown) => {
  if (typeof raw === "string") return parseIngredientLine(raw);
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const food = nameOf(item.food);
  if (!food) {
    const line =
      text(item.originalText) || text(item.display) || text(item.note);
    return line ? parseIngredientLine(line) : null;
  }
  const quantity =
    typeof item.quantity === "number" && item.quantity > 0
      ? formatAmount(item.quantity)
      : "";
  return {
    amount: clip(quantity, 40),
    unit: clip(nameOf(item.unit), 40),
    name: clip(food, 200),
    note: clip(text(item.note), 200),
  };
};

const mealieSteps = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((step) =>
          typeof step === "string"
            ? text(step)
            : step && typeof step === "object"
              ? text((step as Record<string, unknown>).text)
              : ""
        )
        .filter(Boolean)
    : [];

const fromMealie = (value: Record<string, unknown>) =>
  finish({
    title: clip(text(value.name), 200),
    description: clip(text(value.description), 4000),
    sourceUrl: httpUrl(value.orgURL ?? value.org_url),
    prepMinutes: minutesFromText(value.prepTime ?? value.prep_time),
    cookMinutes:
      minutesFromText(
        value.performTime ?? value.cookTime ?? value.perform_time
      ) ?? minutesFromText(value.totalTime ?? value.total_time),
    servings: servingsFromText(
      value.recipeServings ?? value.recipeYield ?? value.recipe_yield
    ),
    tags: cleanTags([...namesOf(value.tags), ...namesOf(value.recipeCategory)]),
    ingredients: (value.recipeIngredient as unknown[])
      .map(mealieIngredient)
      .filter((item): item is Ingredient => Boolean(item))
      .slice(0, 80),
    instructions: stepsFromLines(mealieSteps(value.recipeInstructions)),
  });

type Row = Record<string, unknown>;

const rowsOf = (database: Row, name: string) =>
  Array.isArray(database[name])
    ? (database[name] as unknown[]).filter(
        (row): row is Row => Boolean(row) && typeof row === "object"
      )
    : [];

/** Mealie's full-site backup stores its tables in database.json. */
const fromMealieDatabase = (database: Row) => {
  const recipeRows = rowsOf(database, "recipes");
  const units = new Map(
    rowsOf(database, "ingredient_units").map((row) => [
      String(row.id),
      text(row.name) || text(row.abbreviation),
    ])
  );
  const foods = new Map(
    rowsOf(database, "ingredient_foods").map((row) => [
      String(row.id),
      text(row.name),
    ])
  );
  const tagNames = new Map(
    rowsOf(database, "tags").map((row) => [String(row.id), text(row.name)])
  );
  const categoryNames = new Map(
    rowsOf(database, "categories").map((row) => [
      String(row.id),
      text(row.name),
    ])
  );
  const byRecipe = <T>(rows: Row[], map: (row: Row) => T) => {
    const grouped = new Map<string, { position: number; value: T }[]>();
    for (const row of rows) {
      const key = String(row.recipe_id);
      const list = grouped.get(key) ?? [];
      list.push({ position: Number(row.position ?? 0), value: map(row) });
      grouped.set(key, list);
    }
    return (id: string) =>
      (grouped.get(id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.value);
  };
  const ingredientsFor = byRecipe(
    rowsOf(database, "recipes_ingredients"),
    (row) =>
      mealieIngredient({
        quantity: row.quantity,
        unit: units.get(String(row.unit_id)) ?? "",
        food: foods.get(String(row.food_id)) ?? "",
        note: row.note,
        originalText: row.original_text,
        display: row.display,
      })
  );
  const stepsFor = byRecipe(rowsOf(database, "recipe_instructions"), (row) =>
    text(row.text)
  );
  const linksFor = (
    table: string,
    column: string,
    names: Map<string, string>
  ) => {
    const grouped = new Map<string, string[]>();
    for (const row of rowsOf(database, table)) {
      const key = String(row.recipe_id);
      const name = names.get(String(row[column]));
      if (!name) continue;
      grouped.set(key, [...(grouped.get(key) ?? []), name]);
    }
    return (id: string) => grouped.get(id) ?? [];
  };
  const tagsFor = linksFor("recipes_to_tags", "tag_id", tagNames);
  const categoriesFor = linksFor(
    "recipes_to_categories",
    "category_id",
    categoryNames
  );

  return recipeRows.map((row) => {
    const id = String(row.id);
    const recipe = finish({
      title: clip(text(row.name), 200),
      description: clip(text(row.description), 4000),
      sourceUrl: httpUrl(row.org_url),
      prepMinutes: minutesFromText(row.prep_time),
      cookMinutes:
        minutesFromText(row.perform_time ?? row.cook_time) ??
        minutesFromText(row.total_time),
      servings: servingsFromText(row.recipe_servings ?? row.recipe_yield),
      tags: cleanTags([...tagsFor(id), ...categoriesFor(id)]),
      ingredients: ingredientsFor(id)
        .filter((item): item is Ingredient => Boolean(item))
        .slice(0, 80),
      instructions: stepsFromLines(stepsFor(id).filter(Boolean)),
    });
    return {
      id,
      slug: text(row.slug),
      name: text(row.name),
      recipe,
    };
  });
};

export const sniffImage = (bytes: Uint8Array) => {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  const tag = (start: number) =>
    String.fromCharCode(...bytes.slice(start, start + 4));
  if (tag(0) === "RIFF" && tag(8) === "WEBP") return "webp";
  if (tag(4) === "ftyp" && /avi[fs]/.test(tag(8))) return "avif";
  return null;
};

const imageFromZip = (files: Unzipped, hints: string[]) => {
  const wanted = hints.filter(Boolean);
  if (wanted.length === 0) return null;
  const candidates = Object.keys(files)
    .filter((path) => {
      const parts = path.toLowerCase().split("/");
      return (
        /\.(jpe?g|png|webp|gif|avif)$/i.test(path) &&
        wanted.some((hint) => parts.includes(hint.toLowerCase()))
      );
    })
    .sort((a, b) => {
      const score = (path: string) => (/original\./i.test(path) ? 0 : 1);
      return score(a) - score(b);
    });
  for (const path of candidates) {
    const bytes = files[path];
    if (!bytes || bytes.length > 8 * 1024 * 1024) continue;
    const extension = sniffImage(bytes);
    if (extension) return { bytes, extension };
  }
  return null;
};

const parseJson = (raw: string) => {
  try {
    return JSON.parse(raw.replace(/^﻿/, ""));
  } catch {
    return undefined;
  }
};

const fromJsonValue = (value: unknown, label: string, result: ImportResult) => {
  if (value === undefined) {
    result.skipped.push(`${label}: not valid JSON`);
    return [] as { recipe: RecipeInput; slug: string; id: string }[];
  }
  const out: { recipe: RecipeInput; slug: string; id: string }[] = [];
  const objects = (Array.isArray(value) ? value : [value]).filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );

  for (const object of objects) {
    if (
      Array.isArray(object.recipes) &&
      Array.isArray(object.recipes_ingredients)
    ) {
      for (const entry of fromMealieDatabase(object)) {
        if (entry.recipe)
          out.push({ recipe: entry.recipe, slug: entry.slug, id: entry.id });
        else
          result.skipped.push(
            `${entry.name || label}: no ingredients or steps`
          );
      }
      continue;
    }
    if (isMealie(object)) {
      const recipe = fromMealie(object);
      if (recipe)
        out.push({ recipe, slug: text(object.slug), id: text(object.id) });
      else
        result.skipped.push(
          `${text(object.name) || label}: no ingredients or steps`
        );
      continue;
    }
    if (isPaprika(object)) {
      const imported = fromPaprika(object);
      if (imported) {
        if (imported.image) result.recipes.push(imported);
        else out.push({ recipe: imported.recipe, slug: "", id: "" });
      } else
        result.skipped.push(
          `${text(object.name) || label}: no ingredients or steps`
        );
      continue;
    }
    const found: Record<string, unknown>[] = [];
    collectRecipes(object, found);
    if (Array.isArray(object.items)) collectRecipes(object.items, found);
    if (found.length === 0) {
      result.skipped.push(`${label}: no recipe found`);
      continue;
    }
    for (const item of found) {
      const recipe = recipeFromJsonLd(item);
      if (recipe) out.push({ recipe, slug: "", id: "" });
      else
        result.skipped.push(
          `${text(item.name) || label}: no ingredients or steps`
        );
    }
  }
  return out;
};

const unzipLimited = (bytes: Uint8Array) => {
  let total = 0;
  return unzipSync(bytes, {
    filter: (file) => {
      total += file.originalSize;
      return total <= maxUnpacked && !file.name.endsWith("/");
    },
  });
};

const isZip = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
const isGzip = (bytes: Uint8Array) =>
  bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/**
 * turns an uploaded file into recipes. Understands Paprika exports
 * (.paprikarecipes / .paprikarecipe), Mealie recipe exports and backups (.zip
 * or .json), schema.org JSON-LD (.json), and saved recipe pages (.html).
 */
export const readImportFile = (name: string, bytes: Uint8Array) => {
  const result: ImportResult = { recipes: [], skipped: [] };
  const lower = name.toLowerCase();

  const addAll = (
    entries: { recipe: RecipeInput; slug: string; id: string }[],
    files?: Unzipped
  ) => {
    for (const entry of entries) {
      const image = files ? imageFromZip(files, [entry.slug, entry.id]) : null;
      if (image) entry.recipe.image = null;
      result.recipes.push({ recipe: entry.recipe, image });
    }
  };

  if (isZip(bytes)) {
    let files: Unzipped;
    try {
      files = unzipLimited(bytes);
    } catch {
      result.skipped.push(`${name}: could not open the zip file`);
      return result;
    }
    for (const [path, data] of Object.entries(files)) {
      const entry = path.toLowerCase();
      if (entry.endsWith(".paprikarecipe")) {
        try {
          const value = parseJson(strFromU8(gunzipLimited(data)));
          if (value && typeof value === "object" && isPaprika(value as Row)) {
            const imported = fromPaprika(value as Row);
            if (imported) result.recipes.push(imported);
            else result.skipped.push(`${path}: no ingredients or steps`);
          } else result.skipped.push(`${path}: not a Paprika recipe`);
        } catch {
          result.skipped.push(`${path}: could not read`);
        }
      } else if (entry.endsWith(".json")) {
        addAll(fromJsonValue(parseJson(strFromU8(data)), path, result), files);
      } else if (entry.endsWith(".html") || entry.endsWith(".htm")) {
        const parsed = parseRecipeHtml(strFromU8(data));
        if (parsed.ok)
          result.recipes.push({ recipe: parsed.recipe, image: null });
        else result.skipped.push(`${path}: ${parsed.error}`);
      }
    }
    if (result.recipes.length === 0 && result.skipped.length === 0)
      result.skipped.push(`${name}: no recipes found in the zip file`);
    return result;
  }

  if (isGzip(bytes)) {
    try {
      const value = parseJson(strFromU8(gunzipLimited(bytes)));
      addAll(fromJsonValue(value, name, result));
    } catch {
      result.skipped.push(`${name}: could not read`);
    }
    return result;
  }

  const raw = strFromU8(bytes);
  if (lower.endsWith(".html") || lower.endsWith(".htm") || /^\s*</.test(raw)) {
    const parsed = parseRecipeHtml(raw);
    if (parsed.ok) result.recipes.push({ recipe: parsed.recipe, image: null });
    else result.skipped.push(`${name}: ${parsed.error}`);
    return result;
  }

  addAll(fromJsonValue(parseJson(raw), name, result));
  return result;
};
