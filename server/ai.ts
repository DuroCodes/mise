import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, Output, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { recipeInput, type Recipe } from "../src/shared/recipe";
import { publicRecipeUrl } from "./fetch-recipe";

/**
 * Optional model features. They stay off unless `MISE_AI_API_KEY` is set, so
 * recipes never leave the machine unless the person running mise opts in.
 *
 * `MISE_AI_MODEL` picks the provider and model, as `provider:model`. A bare
 * model id, or no model at all, means Anthropic. Examples:
 * `anthropic:claude-opus-5-5`, `openai:gpt-5`, `openrouter:openai/gpt-5`.
 */
type ProviderId = "anthropic" | "openai" | "openrouter";

const providers = new Set<ProviderId>(["anthropic", "openai", "openrouter"]);

export const aiSetup = () => {
  const raw = process.env.MISE_AI_MODEL?.trim();
  let provider: ProviderId = "anthropic";
  let model = "claude-opus-5-5";
  if (raw) {
    const split = raw.indexOf(":");
    const head = split === -1 ? "" : raw.slice(0, split);
    if (providers.has(head as ProviderId) && split < raw.length - 1) {
      provider = head as ProviderId;
      model = raw.slice(split + 1);
    } else {
      model = raw;
    }
  }
  const apiKey = process.env.MISE_AI_API_KEY?.trim() ?? "";
  if (!apiKey || !model) return null;
  const baseURL = process.env.MISE_AI_BASE_URL?.trim() || undefined;
  return { provider, model, apiKey, baseURL };
};

export const aiEnabled = () => aiSetup() !== null;

const languageModel = () => {
  const setup = aiSetup();
  if (!setup) throw new Error("AI is not set up");
  if (setup.provider === "anthropic") {
    return createAnthropic({
      apiKey: setup.apiKey,
      baseURL: setup.baseURL,
    })(setup.model);
  }
  const openai = createOpenAI({
    apiKey: setup.apiKey,
    baseURL:
      setup.baseURL ??
      (setup.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : undefined),
  });
  return openai.chat(setup.model);
};

export const aiImageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type AiImageType = (typeof aiImageTypes)[number];

const extracted = z.object({
  found: z.boolean(),
  title: z.string(),
  description: z.string(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  servings: z.number().int().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      amount: z.string(),
      unit: z.string(),
      name: z.string(),
      note: z.string(),
    })
  ),
  instructions: z.array(z.string()),
});

type Extracted = z.infer<typeof extracted>;

const clip = (value: string, max: number) => value.trim().slice(0, max);
const within = (value: number | null, low: number, high: number) =>
  value !== null && Number.isInteger(value) && value >= low && value <= high
    ? value
    : null;

/** Fits model output to mise's limits. Exported for tests. */
export const toRecipeInput = (value: Extracted) => {
  if (!value.found) return null;
  const parsed = recipeInput.safeParse({
    title: clip(value.title, 200),
    description: clip(value.description, 4000),
    prepMinutes: within(value.prepMinutes, 0, 1440),
    cookMinutes: within(value.cookMinutes, 0, 1440),
    servings: within(value.servings, 1, 999),
    tags: value.tags
      .map((tag) => clip(tag, 40))
      .filter(Boolean)
      .slice(0, 20),
    ingredients: value.ingredients
      .map((item) => ({
        amount: clip(item.amount, 40),
        unit: clip(item.unit, 40),
        name: clip(item.name, 200),
        note: clip(item.note, 200),
      }))
      .filter((item) => item.name)
      .slice(0, 80),
    instructions: value.instructions
      .map((text) => clip(text, 2000))
      .filter(Boolean)
      .slice(0, 80)
      .map((text) => ({ text })),
  });
  if (
    !parsed.success ||
    (!parsed.data.ingredients.length && !parsed.data.instructions.length)
  )
    return null;
  return parsed.data;
};

const extractionPrompt = `You turn recipes into structured data for a recipe manager.
The input is pasted text, a photo (a cookbook page, a handwritten card, a screenshot), or both.
Copy what the recipe says; do not invent ingredients, amounts, or steps that are not there.
- Split each ingredient into amount (keep fractions like "1/2" or ranges like "2-3" as written), unit (short form such as g, kg, ml, tsp, tbsp, cup, oz, lb, clove, can; empty when there is none), name, and note (preparation such as "finely chopped", or empty).
- Each instruction is one step, without its leading number.
- Times are whole minutes, servings a whole number; use null when the recipe does not say.
- Tags are a few short lowercase words (cuisine, course, main ingredient) and may be empty.
- If the input does not contain a recipe, set found to false and leave the other fields empty.`;

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string };

const failure = (error: unknown) => {
  console.error(error);
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403)
      return { ok: false as const, error: "The API key was rejected" };
    if (error.statusCode === 429)
      return {
        ok: false as const,
        error: "The model is busy. Try again in a minute.",
      };
    return {
      ok: false as const,
      error: "The model could not answer that right now",
    };
  }
  return { ok: false as const, error: "Could not reach the model" };
};

type Part =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType: AiImageType };

const objectFrom = async <T>(
  schema: z.ZodType<T>,
  system: string,
  content: Part[] | string
) => {
  const result = await generateText({
    model: languageModel(),
    system,
    messages: [
      {
        role: "user",
        content,
      },
    ],
    output: Output.object({ schema }),
    maxOutputTokens: 8000,
  });
  return result.output;
};

export const extractRecipe = async (input: {
  text: string;
  image: { data: string; mediaType: AiImageType } | null;
}) => {
  if (!aiEnabled())
    return { ok: false as const, error: "AI is not set up on this server" };
  const content: Part[] = [];
  if (input.image) {
    content.push({
      type: "image",
      image: input.image.data,
      mediaType: input.image.mediaType,
    });
  }
  content.push({
    type: "text",
    text: input.text.trim()
      ? `<recipe>\n${input.text.trim()}\n</recipe>`
      : "The recipe is in the image.",
  });

  try {
    const output = await objectFrom(extracted, extractionPrompt, content);
    if (!output)
      return {
        ok: false as const,
        error: "The model's answer could not be read",
      };
    const recipe = toRecipeInput(output);
    if (!recipe)
      return { ok: false as const, error: "No recipe was found in that" };
    return { ok: true as const, value: recipe };
  } catch (error) {
    return failure(error);
  }
};

const pageText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);

/** Downloads a public page as plain text. Exported for the model tools. */
export const readPublicPage = async (raw: string) => {
  let current = await publicRecipeUrl(raw);
  if (!current) return null;
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mise/0.1 (recipe import)",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = await publicRecipeUrl(
          new URL(location, current).toString()
        );
        if (!next) return null;
        current = next;
        continue;
      }
      if (!response.ok) return null;
      const html = await response.text();
      if (html.length > 2_000_000) return null;
      const text = pageText(html);
      return text.length > 0 ? text : null;
    }
  } catch {
    return null;
  }
  return null;
};

/** Reads a recipe page the direct importer could not parse. */
export const recipeFromUrl = async (url: string) => {
  if (!aiEnabled())
    return { ok: false as const, error: "AI is not set up on this server" };
  const page = await readPublicPage(url);
  if (!page)
    return {
      ok: false as const,
      error:
        "That site blocked the download. Save the page and import the file instead.",
    };
  try {
    const output = await objectFrom(
      extracted,
      extractionPrompt,
      `<page url="${url}">\n${page}\n</page>`
    );
    if (!output)
      return {
        ok: false as const,
        error: "The model's answer could not be read",
      };
    const recipe = toRecipeInput(output);
    if (!recipe)
      return { ok: false as const, error: "No recipe was found on that page" };
    return { ok: true as const, value: { ...recipe, sourceUrl: url } };
  } catch (error) {
    return failure(error);
  }
};

const photoItems = z.object({
  items: z.array(
    z.object({ name: z.string(), amount: z.string(), unit: z.string() })
  ),
});

export type PhotoItem = { name: string; amount: string; unit: string };

/** Fits model output to pantry limits. Exported for tests. */
export const toPhotoItems = (value: z.infer<typeof photoItems>) => {
  const seen = new Set<string>();
  const out: PhotoItem[] = [];
  for (const item of value.items) {
    const name = clip(item.name, 200).toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      amount: clip(item.amount, 40),
      unit: clip(item.unit, 40),
    });
    if (out.length >= 80) break;
  }
  return out;
};

const photoPrompts = {
  receipt: `List the groceries bought on this receipt for a pantry tracker.
- Turn store abbreviations into plain lowercase names ("YEL ONION" -> "yellow onion", "GV WHL MILK" -> "whole milk"). Drop brand names.
- amount is how many or how much was bought (e.g. "2", "1.5"); unit is the unit if there is one (lb, oz, gallon, dozen), else empty.
- Skip anything that isn't food or a cooking ingredient, and skip tax, totals, discounts, bags, and deposits.`,
  fridge: `List the food you can clearly see in this photo of a fridge, pantry, or counter, for a pantry tracker.
- Use plain lowercase names without brands ("cheddar cheese", "eggs").
- Give an amount only when it's obvious (a carton of 12 eggs -> "12"); otherwise leave amount and unit empty.
- Don't guess at things you can't see.`,
};

export const readPantryPhoto = async (input: {
  image: { data: string; mediaType: AiImageType };
  kind: "receipt" | "fridge";
}) => {
  if (!aiEnabled())
    return { ok: false as const, error: "AI is not set up on this server" };
  try {
    const output = await objectFrom(photoItems, photoPrompts[input.kind], [
      {
        type: "image",
        image: input.image.data,
        mediaType: input.image.mediaType,
      },
      {
        type: "text",
        text:
          input.kind === "receipt"
            ? "Here's my receipt."
            : "Here's what I have.",
      },
    ]);
    if (!output)
      return {
        ok: false as const,
        error: "The model's answer could not be read",
      };
    const items = toPhotoItems(output);
    if (items.length === 0)
      return {
        ok: false as const,
        error:
          input.kind === "receipt"
            ? "No groceries found on that receipt"
            : "No food found in that photo",
      };
    return { ok: true as const, value: items };
  } catch (error) {
    return failure(error);
  }
};

const foundSchema = z.array(
  z.object({
    title: z.string(),
    url: z.string(),
    why: z.string().default(""),
    uses: z.array(z.string()).default([]),
  })
);

export type FoundRecipe = {
  title: string;
  url: string;
  site: string;
  why: string;
  uses: string[];
};

const normalizeUrl = (raw: string) => {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

/** Pulls the JSON array out of the model's final text (a ```json block or a bare array). */
export const parseFound = (text: string, searched: Set<string>) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const bare = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  let raw: unknown;
  try {
    raw = JSON.parse((fenced ?? bare).trim());
  } catch {
    return [];
  }
  const parsed = foundSchema.safeParse(raw);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  const out: FoundRecipe[] = [];
  for (const item of parsed.data) {
    const url = normalizeUrl(item.url);
    // Only links that actually came back from a search, so nothing is invented.
    if (!url || !searched.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title: clip(item.title, 200) || new URL(url).hostname,
      url,
      site: new URL(url).hostname.replace(/^www\./, ""),
      why: clip(item.why, 300),
      uses: item.uses
        .map((use) => clip(use, 60))
        .filter(Boolean)
        .slice(0, 12),
    });
    if (out.length >= 6) break;
  }
  return out;
};

/** Result links from a DuckDuckGo HTML page, including uddg redirects. */
export const linksFromSearchHtml = (html: string) => {
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = (match[1].match(/href="([^"]+)"/i)?.[1] ?? "").replace(
      /&amp;/g,
      "&"
    );
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    const raw = uddg ? decodeURIComponent(uddg[1]) : href;
    if (!/^https?:\/\//i.test(raw) || /duckduckgo\.com/i.test(raw)) continue;
    const url = normalizeUrl(raw);
    if (!url || seen.has(url)) continue;
    const title = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    seen.add(url);
    out.push({ title: title.slice(0, 200), url });
    if (out.length >= 8) break;
  }
  return out;
};

const searchWeb = async (query: string) => {
  const target = await publicRecipeUrl(
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  );
  if (!target) return [];
  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        "user-agent": "Mise/0.1 (recipe search)",
        accept: "text/html",
      },
    });
    if (!response.ok) return [];
    return linksFromSearchHtml(await response.text());
  } catch {
    return [];
  }
};

const findPrompt = `You find real recipes on the web for a home cook who wants to use what's in their pantry.
Call search_web. Pick individual recipe pages (not roundups or listicles) from the results, since each one will be imported into a recipe app.
Prefer recipes that use several of the pantry items and need few extra ingredients.
Use only URLs that search_web returned. Do not invent links.
Finish with only a JSON array in a \`\`\`json code block, 3 to 6 items, each:
{"title": "...", "url": "the exact page URL from the search results", "why": "one short sentence on why it fits", "uses": ["pantry items it uses"]}`;

export const findRecipes = async (pantry: string[], focus: string) => {
  if (!aiEnabled())
    return { ok: false as const, error: "AI is not set up on this server" };
  const list = pantry
    .slice(0, 80)
    .map((name) => `- ${name}`)
    .join("\n");
  const searched = new Set<string>();
  let searches = 0;

  try {
    const result = await generateText({
      model: languageModel(),
      system: findPrompt,
      prompt: `<pantry>\n${list}\n</pantry>${focus.trim() ? `\n\nWhat I'm in the mood for: ${focus.trim()}` : ""}`,
      tools: {
        search_web: tool({
          description: "Search the web. Returns recipe page titles and URLs.",
          inputSchema: z.object({ query: z.string().min(1).max(200) }),
          execute: async ({ query }) => {
            if (searches >= 5) return [];
            searches += 1;
            const links = await searchWeb(query);
            for (const link of links) searched.add(link.url);
            return links;
          },
        }),
      },
      stopWhen: stepCountIs(6),
      maxOutputTokens: 4000,
    });
    if (result.finishReason === "content-filter")
      return {
        ok: false as const,
        error: "The model declined to search for that",
      };
    const found = parseFound(result.text, searched);
    if (found.length === 0)
      return {
        ok: false as const,
        error: "No recipes came back this time. Try again or change the focus.",
      };
    return { ok: true as const, value: found };
  } catch (error) {
    return failure(error);
  }
};

export const askAboutRecipe = async (
  recipe: Pick<Recipe, "title" | "servings" | "ingredients" | "instructions">,
  question: string
) => {
  if (!aiEnabled())
    return { ok: false as const, error: "AI is not set up on this server" };
  const ingredients = recipe.ingredients
    .map((item) =>
      [item.amount, item.unit, item.name, item.note ? `(${item.note})` : ""]
        .filter(Boolean)
        .join(" ")
    )
    .join("\n");
  const steps = recipe.instructions
    .map((step, index) => `${index + 1}. ${step.text}`)
    .join("\n");

  try {
    const result = await generateText({
      model: languageModel(),
      system:
        "You help a home cook with one recipe: ingredient substitutions, swaps for allergies or diets, and what to do when they are missing something. Answer in short Markdown: one opening sentence, then a bulleted list where each item starts with the swap in bold, followed by how to use it. Use only bold, italics, and lists (no headings, tables, links, or code). For a simple yes/no question, a sentence or two is enough. Say how a swap changes the dish and adjust amounts when that matters. If a swap would not work, say so.",
      prompt: `<recipe title="${recipe.title.replace(/"/g, "'")}" servings="${recipe.servings ?? "unknown"}">\n<ingredients>\n${ingredients}\n</ingredients>\n<steps>\n${steps}\n</steps>\n</recipe>\n\n${question.trim()}`,
      maxOutputTokens: 2000,
    });
    if (result.finishReason === "content-filter")
      return { ok: false as const, error: "The model declined to answer that" };
    const answer = result.text.trim();
    if (!answer)
      return { ok: false as const, error: "The model did not answer" };
    return { ok: true as const, value: answer };
  } catch (error) {
    return failure(error);
  }
};
