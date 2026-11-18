import type { Ingredient } from "../src/shared/recipe";
import { recipeInput } from "../src/shared/recipe";

const units = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "kilogram",
  "kilograms",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "ml",
  "l",
  "liter",
  "liters",
  "litre",
  "litres",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tbs",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "fl oz",
  "pint",
  "pints",
  "quart",
  "quarts",
  "gallon",
  "gallons",
  "clove",
  "cloves",
  "can",
  "cans",
  "package",
  "packages",
  "packet",
  "packets",
  "bunch",
  "bunches",
  "slice",
  "slices",
  "sprig",
  "sprigs",
  "head",
  "heads",
  "stalk",
  "stalks",
  "stick",
  "sticks",
  "piece",
  "pieces",
  "pinch",
  "pinches",
]);

const amountPattern =
  /^(?:\d+\s+\d+\/\d+|\d+\s*(?:-|to)\s*\d+|\d+\/\d+|\d+(?:\.\d+)?|\d*\s*[½⅓⅔¼¾⅛⅜⅝⅞])(?=\s|$)/i;

const unitKey = (value: string) =>
  value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

const decode = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, digits: string) =>
      String.fromCodePoint(Number(digits))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&frac12;/gi, "½")
    .replace(/&frac14;/gi, "¼")
    .replace(/&frac34;/gi, "¾");

const plain = (value: unknown) => {
  if (typeof value !== "string") return "";
  return decode(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const clip = (value: string, max: number) => value.trim().slice(0, max);

/** Bullets and "2. " prefixes that some sites leave on each line. */
const listMarker = (value: string) =>
  value
    .replace(/^[\u2022\u2023\u25E6\u2043\u2219\u00B7•·▪▫‣⁃]\s*/, "")
    .replace(/^[-*–—]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();

const unitLength = (words: string[]) => {
  const two = unitKey(words.slice(0, 2).join(" "));
  if (words.length >= 2 && units.has(two)) return 2;
  const one = unitKey(words[0] ?? "");
  if (one && units.has(one)) return 1;
  return 0;
};

const tidyNote = (value: string) => {
  let note = value.trim().replace(/^(?:,\s*)+/, "");
  while (note.startsWith("(") && note.endsWith(")") && note.length > 2) {
    const inner = note
      .slice(1, -1)
      .trim()
      .replace(/^(?:,\s*)+/, "");
    if (!inner || inner === note) break;
    note = inner;
  }
  return note.trim();
};

const peelTrailingNote = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.endsWith(")")) return null;
  let depth = 0;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const char = trimmed[index];
    if (char === ")") depth += 1;
    else if (char === "(") {
      depth -= 1;
      if (depth === 0) {
        return {
          rest: trimmed.slice(0, index).trim(),
          note: tidyNote(trimmed.slice(index + 1, -1)),
        };
      }
    }
  }
  return null;
};

const withoutGroups = (value: string) => {
  const notes: string[] = [];
  let rest = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "(") {
      rest += value[index];
      continue;
    }
    let depth = 1;
    let end = index + 1;
    for (; end < value.length && depth > 0; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") depth -= 1;
    }
    if (depth === 0) {
      const note = tidyNote(value.slice(index + 1, end - 1));
      if (note) notes.push(note);
      index = end - 1;
    } else rest += value[index];
  }
  return { rest: rest.replace(/\s+/g, " ").trim(), notes };
};

export const parseIngredientLine = (raw: string) => {
  let text = listMarker(plain(raw));
  if (!text || text.endsWith(":")) return null;

  const notes: string[] = [];
  const trailing = peelTrailingNote(text);
  if (trailing?.note) {
    text = trailing.rest;
    notes.push(trailing.note);
  }
  const grouped = withoutGroups(text);
  text = grouped.rest.replace(/\s+,/g, ",");
  notes.push(...grouped.notes);

  const comma = text.match(/^(.*\S),\s+([^,]+)$/);
  if (comma && !comma[1].includes(",") && !/\d/.test(comma[2])) {
    text = comma[1].trim();
    notes.push(tidyNote(comma[2]));
  }

  const dual = text.match(
    /^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(kg|g|lb|lbs|oz)\s*\/\s*(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(kg|g|lb|lbs|oz)\b\s*/i
  );
  let amount = "";
  let unit = "";
  if (dual) {
    amount = dual[1]?.replace(/\s+/g, "") ?? "";
    unit = dual[2] ?? "";
    notes.unshift(`${dual[3]} ${dual[4]}`);
    text = text.slice(dual[0].length).trim();
  } else {
    const amountMatch = text.match(amountPattern);
    if (amountMatch) {
      amount = amountMatch[0].replace(/\s+/g, " ").trim();
      text = text.slice(amountMatch[0].length).trim();
    }
    const words = text.split(" ").filter(Boolean);
    const taken = unitLength(words);
    unit = words.slice(0, taken).join(" ");
    text = words.slice(taken).join(" ").trim();
  }

  const name = text.trim();
  if (!name) return null;

  return {
    amount: clip(amount, 40),
    unit: clip(unit, 40),
    name: clip(name, 200),
    note: clip(notes.filter(Boolean).join(", "), 200),
  };
};

export const minutesOf = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round(value);
    return minutes >= 0 && minutes <= 1440 ? minutes : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return minutes <= 1440 ? minutes : null;
  }
  const match = trimmed.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return null;
  const total =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0) +
    Math.round(Number(match[4] ?? 0) / 60);
  return total >= 0 && total <= 1440 ? total : null;
};

const servingsOf = (value: unknown) => {
  const raw = Array.isArray(value)
    ? value.map((item) => plain(String(item))).join(" ")
    : plain(value);
  const match = raw.match(/\d+/);
  if (!match) return null;
  const servings = Number(match[0]);
  return servings >= 1 && servings <= 999 ? servings : null;
};

const imageOf = (value: unknown) => {
  const urls: string[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string") urls.push(node.trim());
    else if (Array.isArray(node)) node.forEach(visit);
    else if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      visit(record.url);
      visit(record.contentUrl);
    }
  };
  visit(value);
  for (const url of urls) {
    const absolute = url.startsWith("//") ? `https:${url}` : url;
    if (/^https?:\/\//i.test(absolute) && absolute.length <= 2000)
      return absolute;
  }
  return null;
};

const addTags = (value: unknown, tags: string[]) => {
  if (typeof value === "string") {
    for (const part of value.split(/[,;|]/)) tags.push(part);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) addTags(item, tags);
  }
};

const stepsOf = (value: unknown) => {
  const steps: string[] = [];
  const visit = (node: unknown, section: string) => {
    if (!node) return;
    if (typeof node === "string") {
      const text = listMarker(plain(node));
      if (text) steps.push(section ? `${section}: ${text}` : text);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, section);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    const types = (Array.isArray(type) ? type : [type]).filter(
      (item): item is string => typeof item === "string"
    );
    if (types.includes("HowToSection")) {
      visit(record.itemListElement, plain(record.name));
      return;
    }
    if (typeof record.text === "string") {
      const text = listMarker(plain(record.text));
      if (text)
        steps.push(
          section && !/^instructions?$/i.test(section)
            ? `${section}: ${text}`
            : text
        );
      return;
    }
    if (record.itemListElement) visit(record.itemListElement, section);
  };
  visit(value, "");
  return steps
    .map((step) => clip(step, 2000))
    .filter(Boolean)
    .slice(0, 80);
};

const ingredientLines = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    if (typeof item === "string") lines.push(item);
    else if (item && typeof item === "object" && "text" in item)
      lines.push(plain((item as { text: unknown }).text));
  }
  return lines;
};

export const isRecipe = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as { "@type"?: unknown })["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (item) =>
      item === "Recipe" ||
      item === "https://schema.org/Recipe" ||
      item === "http://schema.org/Recipe"
  );
};

export const collectRecipes = (
  node: unknown,
  found: Record<string, unknown>[]
) => {
  if (Array.isArray(node)) {
    for (const item of node) collectRecipes(item, found);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (isRecipe(record)) found.push(record);
  if (record["@graph"]) collectRecipes(record["@graph"], found);
  if (record.mainEntity) collectRecipes(record.mainEntity, found);
};

const pageTitle = (html: string) => {
  const og = html.match(
    /<meta\b[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i
  );
  const swapped = html.match(
    /<meta\b[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:title["'][^>]*>/i
  );
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const raw = plain(og?.[1] ?? swapped?.[1] ?? heading?.[1] ?? "");
  return raw.replace(/\s+[-|]\s+.*$/, "").trim();
};

const urlOf = (value: unknown) => {
  const candidates: unknown[] = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const raw =
      typeof candidate === "string"
        ? candidate
        : candidate && typeof candidate === "object"
          ? ((candidate as Record<string, unknown>)["@id"] ??
            (candidate as Record<string, unknown>).url)
          : null;
    if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
      const trimmed = raw.trim();
      if (trimmed.length > 2000) continue;
      try {
        new URL(trimmed);
        return trimmed;
      } catch {
        continue;
      }
    }
  }
  return null;
};

/** Converts one schema.org Recipe object into mise's recipe shape. */
export const recipeFromJsonLd = (
  recipe: Record<string, unknown>,
  fallbackTitle = ""
) => {
  const tags: string[] = [];
  addTags(recipe.keywords, tags);
  addTags(recipe.recipeCategory, tags);
  addTags(recipe.recipeCuisine, tags);

  const prepMinutes = minutesOf(recipe.prepTime);
  const cookMinutes =
    minutesOf(recipe.cookTime) ??
    (prepMinutes === null ? minutesOf(recipe.totalTime) : null);

  const fromRecipe =
    plain(typeof recipe.headline === "string" ? recipe.headline : "") ||
    plain(recipe.name);
  const title =
    fallbackTitle &&
    fromRecipe &&
    fallbackTitle.toLowerCase() === fromRecipe.toLowerCase()
      ? fallbackTitle
      : fromRecipe || fallbackTitle;

  const parsed = recipeInput.safeParse({
    title: clip(title, 200),
    description: clip(plain(recipe.description), 4000),
    image: imageOf(recipe.image),
    sourceUrl: urlOf(recipe.url) ?? urlOf(recipe.mainEntityOfPage),
    prepMinutes,
    cookMinutes,
    servings: servingsOf(recipe.recipeYield),
    favorite: false,
    tags: tags
      .map((tag) => clip(plain(tag), 40))
      .filter(Boolean)
      .slice(0, 20),
    ingredients: ingredientLines(recipe.recipeIngredient)
      .map(parseIngredientLine)
      .filter((item): item is Ingredient => Boolean(item))
      .slice(0, 80),
    instructions: stepsOf(recipe.recipeInstructions).map((text) => ({ text })),
  });

  if (
    !parsed.success ||
    (!parsed.data.ingredients.length && !parsed.data.instructions.length)
  )
    return null;
  return parsed.data;
};

export const parseRecipeHtml = (html: string) => {
  const found: Record<string, unknown>[] = [];
  const pattern =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = (match[1] ?? "").trim();
    // Parse the JSON as published first. Decoding HTML entities up front
    // turns an escaped &quot; inside a string into a bare quote and breaks
    // valid JSON, so only fall back to decoding for pages that need it.
    for (const text of [raw, decode(raw).trim()]) {
      try {
        collectRecipes(JSON.parse(text), found);
        break;
      } catch {
        continue;
      }
    }
  }

  const recipe =
    found.find(
      (item) =>
        plain(item.name) && ingredientLines(item.recipeIngredient).length
    ) ??
    found.find((item) => plain(item.name)) ??
    null;
  if (!recipe)
    return { ok: false as const, error: "That page did not include a recipe" };

  const converted = recipeFromJsonLd(recipe, pageTitle(html));
  if (!converted)
    return { ok: false as const, error: "That page did not include a recipe" };
  return { ok: true as const, recipe: converted };
};
