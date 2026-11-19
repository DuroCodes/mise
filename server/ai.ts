import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  RetryError,
  generateText,
  stepCountIs,
  tool,
} from "ai";
import { TypeValidationError } from "@ai-sdk/provider";
import { z } from "zod";
import { recipeInput, type Recipe } from "../src/shared/recipe";
import { publicRecipeUrl } from "./fetch-recipe";
import { whisperStatus, type WhisperStatus } from "./whisper";

/**
 * optional model features. They stay off unless the server has a model set
 * up, so recipes never leave the machine unless the person running mise opts
 * in.
 *
 * set `MISE_AI_API_KEY` and `MISE_AI_MODEL` as `provider:model`. The prefix
 * is required and chooses the provider. A local model needs no key:
 * `local:hermes3`, with `MISE_AI_BASE_URL` if it isn't Ollama on this
 * machine. Examples: `anthropic:claude-opus-5-5`, `openai:gpt-5`,
 * `openrouter:openai/gpt-5`.
 *
 * without those, an admin can set the provider, model, and key in Admin > AI.
 * the environment always wins over the saved setting.
 */
export const aiProviders = [
  "anthropic",
  "openai",
  "openrouter",
  "local",
] as const;

type ProviderId = (typeof aiProviders)[number];

type AiSetup = {
  provider: ProviderId;
  model: string;
  /** empty for a local server that doesn't ask for one. */
  apiKey: string;
  baseURL?: string;
};

const providers = new Set<ProviderId>(aiProviders);

/** Ollama's OpenAI-compatible endpoint on the same machine. */
export const localDefaultUrl = "http://localhost:11434/v1";

/** only local servers can run without a key. */
export const needsKey = (provider: ProviderId) => provider !== "local";

const parseEnvModel = (raw: string | undefined) => {
  if (!raw) return null;

  const split = raw.indexOf(":");
  const head = split === -1 ? "" : raw.slice(0, split);

  if (!providers.has(head as ProviderId) || split >= raw.length - 1)
    return null;

  return { provider: head as ProviderId, model: raw.slice(split + 1) };
};

const envSetup = () => {
  const parsed = parseEnvModel(process.env.MISE_AI_MODEL?.trim());
  if (!parsed) return null;

  const { provider, model } = parsed;
  const apiKey = process.env.MISE_AI_API_KEY?.trim() ?? "";

  if ((needsKey(provider) && !apiKey) || !model) return null;

  const baseURL =
    process.env.MISE_AI_BASE_URL?.trim() ||
    (provider === "local" ? localDefaultUrl : undefined);

  return { provider, model, apiKey, baseURL };
};

// same default as db.ts; read here so importing this module never opens the db
const settingsFile = `${process.env.DATA_DIR ?? "./data"}/ai-settings.json`;

const savedShape = z.object({
  provider: z.enum(aiProviders),
  model: z.string().min(1),
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

let saved: AiSetup | null | undefined;
const savedSetup = () => {
  if (saved !== undefined) return saved;
  saved = null;

  if (existsSync(settingsFile)) {
    try {
      const parsed = savedShape.safeParse(
        JSON.parse(readFileSync(settingsFile, "utf8"))
      );

      if (
        parsed.success &&
        (parsed.data.apiKey || !needsKey(parsed.data.provider))
      )
        saved = parsed.data;
    } catch {
      saved = null;
    }
  }

  return saved;
};

export const aiSetup = () => envSetup() ?? savedSetup();
export const aiEnabled = () => aiSetup() !== null;

const modelFor = (setup: AiSetup) => {
  if (setup.provider === "anthropic") {
    return createAnthropic({
      apiKey: setup.apiKey,
      baseURL: setup.baseURL,
    })(setup.model);
  }

  const openai = createOpenAI({
    // local servers like Ollama ignore the key, but the client wants one.
    apiKey: setup.apiKey || "local",
    baseURL:
      setup.baseURL ??
      (setup.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : setup.provider === "local"
          ? localDefaultUrl
          : undefined),
  });

  return openai.chat(setup.model);
};

const languageModel = () => {
  const setup = aiSetup();
  if (!setup) throw new Error("AI is not set up");
  return modelFor(setup);
};

export type AiStatus = {
  enabled: boolean;
  source: "environment" | "saved" | null;
  provider: ProviderId | null;
  model: string | null;
  baseURL: string | null;
  hint: string | null;
  whisper: WhisperStatus;
};

/** what admins see. the key itself never leaves the server. */
export const aiStatus = () => {
  const fromEnv = envSetup();
  const setup = fromEnv ?? savedSetup();

  return {
    enabled: Boolean(setup),
    source: fromEnv ? "environment" : setup ? "saved" : null,
    provider: setup?.provider ?? null,
    model: setup?.model ?? null,
    baseURL: setup?.provider === "local" ? (setup.baseURL ?? null) : null,
    hint: setup?.apiKey ? `…${setup.apiKey.slice(-4)}` : null,
    whisper: whisperStatus(),
  };
};

/** the saved key, so an admin can switch models without pasting it again. */
export const savedKeyFor = (provider: ProviderId) => {
  const setup = savedSetup();
  return setup?.provider === provider ? setup.apiKey : null;
};

/** sends a one-word request to make sure the key and model work. */
export const checkSetup = async (setup: AiSetup) => {
  const local = setup.provider === "local";

  try {
    await generateText({
      model: modelFor(setup),
      prompt: "Reply with the word ok.",
      maxOutputTokens: 16,
      maxRetries: 0,
      // a local model may need to load into memory first.
      abortSignal: AbortSignal.timeout(local ? 120_000 : 30_000),
    });
    return { ok: true, value: null };
  } catch (error) {
    console.error(error);

    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401 || error.statusCode === 403)
        return { ok: false, error: "The provider didn't accept that key" };

      if (error.statusCode === 404)
        return {
          ok: false,
          error: local
            ? "The server doesn't have that model. Pull it first, e.g. ollama pull hermes3."
            : "The provider doesn't know that model",
        };

      if (error.statusCode === 400)
        return { ok: false, error: "The provider rejected that model or key" };

      if (error.statusCode === 429)
        return {
          ok: false,
          error: "The provider is busy. Try again in a minute.",
        };

      if (!error.statusCode && local)
        return {
          ok: false,
          error: `Couldn't reach a model server at ${setup.baseURL ?? localDefaultUrl}. Is Ollama running?`,
        };

      return {
        ok: false,
        error: "Couldn't check the key with the provider right now",
      };
    }

    if (local)
      return {
        ok: false,
        error: `Couldn't reach a model server at ${setup.baseURL ?? localDefaultUrl}. Is Ollama running?`,
      };

    return { ok: false, error: "Couldn't reach the provider to check the key" };
  }
};

export const saveSetup = (setup: AiSetup | null) => {
  if (setup)
    writeFileSync(settingsFile, JSON.stringify(setup), { mode: 0o600 });
  else if (existsSync(settingsFile)) unlinkSync(settingsFile);

  saved = setup;
};

export const aiImageTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

type AiImageType = (typeof aiImageTypes)[number];

/** exact shape sent as json_schema — free models still sometimes ignore it. */
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

const extractedKeys =
  "found, title, description, prepMinutes, cookMinutes, servings, tags, ingredients[{amount,unit,name,note}], instructions[]";

const clip = (value: string, max: number) => value.trim().slice(0, max);
const within = (value: number | null, low: number, high: number) =>
  value !== null && Number.isInteger(value) && value >= low && value <= high
    ? value
    : null;

/**
 * some models (esp. free Groq/Qwen JSON mode) leak schema junk into strings,
 * e.g. "%Y44I1 teaspoon/I %E" or "%I2/I %E whole eggs".
 */
export const scrubModelText = (value: string) =>
  value
    .replace(/%Y\d+I/gi, " ")
    .replace(/%E\b/gi, " ")
    // %I before a digit is a marker; keep the digit (content).
    .replace(/%I(?=\d)/g, " ")
    .replace(/%[A-Za-z]+\b/g, " ")
    .replace(/\/I\b/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();

const clean = (value: string, max: number) => clip(scrubModelText(value), max);

/**
 * models often put "5 tbsp" in unit (or amount) and leave the other blank.
 * pull the leading quantity out when that happens.
 */
export const splitMeasure = (amount: string, unit: string) => {
  const qty = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*(.*)$/;

  if (!amount && unit) {
    const match = unit.match(qty);
    if (match?.[1]) return { amount: match[1], unit: (match[2] ?? "").trim() };
  }

  if (amount && !unit) {
    const match = amount.match(qty);
    if (match?.[1] && match[2])
      return { amount: match[1], unit: match[2].trim() };
  }

  return { amount, unit };
};

/** fits model output to mise's limits. Exported for tests. */
export const toRecipeInput = (value: Extracted) => {
  if (!value.found) return null;

  const parsed = recipeInput.safeParse({
    title: clean(value.title, 200),
    description: clean(value.description, 4000),
    prepMinutes: within(value.prepMinutes, 0, 1440),
    cookMinutes: within(value.cookMinutes, 0, 1440),
    servings: within(value.servings, 1, 999),
    tags: value.tags
      .map((t) => clean(t, 40))
      .filter(Boolean)
      .slice(0, 20),
    ingredients: value.ingredients
      .map((i) => {
        const split = splitMeasure(clean(i.amount, 40), clean(i.unit, 40));

        return {
          amount: split.amount,
          unit: split.unit,
          name: clean(i.name, 200).toLowerCase(),
          note: clean(i.note, 200).toLowerCase(),
        };
      })
      .filter((i) => i.name)
      .slice(0, 80),
    instructions: value.instructions
      .map((t) => clean(t, 2000))
      .filter(Boolean)
      .slice(0, 80)
      .map((t) => ({ text: t })),
  });

  if (
    !parsed.success ||
    (!parsed.data.ingredients.length && !parsed.data.instructions.length)
  )
    return null;

  return parsed.data;
};

const ingredientShape = `Each ingredient is four separate fields — never combine amount and unit:
  {"amount":"5","unit":"tbsp","name":"unsalted butter","note":"melted"}
  {"amount":"3/4","unit":"cup","name":"sugar","note":""}
  {"amount":"2","unit":"","name":"eggs","note":"room temperature"}
Wrong: {"amount":"","unit":"5 tbsp","name":"butter","note":""}
Wrong: {"amount":"5 tbsp","unit":"","name":"butter","note":""}`;

const extractionPrompt = `You turn recipes into structured data for a recipe manager.
The input is pasted text, a photo (a cookbook page, a handwritten card, a screenshot), or both.
Copy what the recipe says; do not invent ingredients, amounts, or steps that are not there.
- ${ingredientShape}
- Unit is only the short unit (g, kg, ml, tsp, tbsp, cup, oz, lb, clove, can) or empty.
- Each instruction is one step, without its leading number.
- Times are whole minutes (prepMinutes, cookMinutes); servings a whole number; use null when the recipe does not say.
- Tags are a few short lowercase words (cuisine, course, main ingredient) and may be empty.
- If the input does not contain a recipe, set found to false and leave the other fields empty.`;

/** spoken video transcripts: rewrite chatty narration into cookable steps. */
const spokenExtractionPrompt = `You turn a cooking video transcript into a clean recipe for a recipe manager.
The input is speech (and maybe a social caption), not a written recipe card. Rewrite it; do not paste the host's wording.
- Title: a short normal recipe name (e.g. "Strawberry Cheesecake Cupcakes"). Never copy the video caption, hashtags, or emojis.
- Description: one plain sentence grounded only in the transcript, or empty. No hashtags, emojis, or marketing fluff. Do not invent methods (e.g. do not say "no-bake" if they bake).
- Ingredients: ${ingredientShape}
- Instructions: short imperative steps a cook can follow (e.g. "Add 1/2 cup sour cream and mix until smooth."). Merge related chatter into one step.
- Drop filler, taste reactions, merch plugs, and phrases like "we're going in with", "like that", "mmm".
- Do not invent ingredients, amounts, steps, or techniques that are not in the transcript.
- Every field must be plain text only — no markup, XML, or tokens like %I /I %E.
- Times are whole minutes, servings a whole number; use null when the recipe does not say.
- Tags are a few short lowercase words and may be empty.
- If there is no recipe, set found to false and leave the other fields empty.`;

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string };

const apiError = (error: unknown) => {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error) && APICallError.isInstance(error.lastError))
    return error.lastError;
  return null;
};

const failure = (error: unknown) => {
  const api = apiError(error);
  console.error(api ?? error);

  if (
    NoObjectGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  )
    return {
      ok: false as const,
      error: "The model's answer could not be read. Try again.",
    };

  if (api) {
    if (api.statusCode === 401 || api.statusCode === 403)
      return { ok: false as const, error: "The API key was rejected" };

    if (api.statusCode === 429)
      return {
        ok: false as const,
        error: "The model is rate-limited. Try again in a minute.",
      };

    const body = typeof api.responseBody === "string" ? api.responseBody : "";
    if (/max_completion_tokens|truncated|json_validate_failed/i.test(body))
      return {
        ok: false as const,
        error:
          "The model ran out of room writing the recipe. Try again in a moment.",
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

const structuredCall = async <T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: Part[] | string
) => {
  const result = await generateText({
    model: languageModel(),
    system,
    ...(typeof prompt === "string"
      ? { prompt }
      : { messages: [{ role: "user" as const, content: prompt }] }),
    output: Output.object({
      schema,
      name: "recipe",
      description: `Recipe extraction. Keys must be exactly: ${extractedKeys}`,
    }),
    providerOptions: {
      openai: { strictJsonSchema: true },
    },
    // Groq free tier is ~8k TPM; 8k completion alone gets truncated mid-JSON.
    maxOutputTokens: 2500,
    // free OpenRouter models 429 often; one retry is enough, then surface it.
    maxRetries: 1,
  });
  return result.output;
};

/**
 * ask for a json_schema object (strict when the provider supports it).
 * if the model still invents keys, one repair pass rewrites to the schema —
 * no silent field aliasing.
 */
const objectFrom = async <T>(
  schema: z.ZodType<T>,
  system: string,
  content: Part[] | string
) => {
  try {
    return await structuredCall(schema, system, content);
  } catch (error) {
    if (
      !NoObjectGeneratedError.isInstance(error) &&
      !TypeValidationError.isInstance(error)
    )
      throw error;

    const bad =
      NoObjectGeneratedError.isInstance(error) && typeof error.text === "string"
        ? error.text
        : TypeValidationError.isInstance(error)
          ? JSON.stringify(error.value)
          : null;
    if (!bad) throw error;

    return await structuredCall(
      schema,
      `The previous JSON failed schema validation. Emit the same recipe using only these keys: ${extractedKeys}. Map prepTime→prepMinutes and cookTime→cookMinutes if present. Invent nothing; title is required (use a short name from the content if missing). description may be "".`,
      `Invalid JSON:\n${bad}\n\nError:\n${error.message}\n\nReturn a valid object only.`
    );
  }
};

export const extractRecipe = async (input: {
  text: string;
  image: { data: string; mediaType: AiImageType } | null;
  /** spoken video transcript — rewrite into clear steps instead of copying narration. */
  spoken?: boolean;
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
    const output = await objectFrom(
      extracted,
      input.spoken ? spokenExtractionPrompt : extractionPrompt,
      content
    );
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

/** downloads a public page as plain text. Exported for the model tools. */
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
      return text.length ? text : null;
    }
  } catch {
    return null;
  }

  return null;
};

/** reads a recipe page the direct importer could not parse. */
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

/** fits model output to pantry limits. Exported for tests. */
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
    if (!items.length)
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

/** pulls the JSON array out of the model's final text (a ```json block or a bare array). */
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
    // only links that actually came back from a search, so nothing is invented.
    if (!url || !searched.has(url) || seen.has(url)) continue;

    seen.add(url);
    out.push({
      title: clip(item.title, 200) || new URL(url).hostname,
      url,
      site: new URL(url).hostname.replace(/^www\./, ""),
      why: clip(item.why, 300),
      uses: item.uses
        .map((u) => clip(u, 60))
        .filter(Boolean)
        .slice(0, 12),
    });
    if (out.length >= 6) break;
  }

  return out;
};

/** result links from a DuckDuckGo HTML page, including uddg redirects. */
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
    .map((n) => `- ${n}`)
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
    if (!found.length)
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
    .map((i) =>
      [i.amount, i.unit, i.name, i.note ? `(${i.note})` : ""]
        .filter(Boolean)
        .join(" ")
    )
    .join("\n");
  const steps = recipe.instructions
    .map((s, i) => `${i + 1}. ${s.text}`)
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

export type PlanSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type PlannerRecipe = Pick<
  Recipe,
  | "id"
  | "title"
  | "tags"
  | "prepMinutes"
  | "cookMinutes"
  | "servings"
  | "favorite"
  | "lastCooked"
  | "cookCount"
  | "rating"
  | "ingredients"
>;

export type PlannedMeal = {
  day: string;
  slot: PlanSlot;
  recipeId: string;
  why: string;
};

export type MealPlanIdea = { meals: PlannedMeal[]; summary: string };

const mealPlanOutput = z.object({
  meals: z.array(
    z.object({
      day: z.string(),
      slot: z.string(),
      recipe: z.string(),
      why: z.string(),
    })
  ),
  summary: z.string(),
});

/** at most this many recipes go to Claude; favorites and regulars first. */
const plannerLimit = 300;

/** picks and orders the recipes Claude sees. Exported for tests. */
export const plannerRecipes = <T extends PlannerRecipe>(recipes: T[]) =>
  [...recipes]
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        (b.rating.mine ?? 0) - (a.rating.mine ?? 0) ||
        b.cookCount - a.cookCount
    )
    .slice(0, plannerLimit);

const recipeLine = (recipe: PlannerRecipe, key: string) => {
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const facts = [
    recipe.tags.length ? `tags: ${recipe.tags.join(", ")}` : "",
    minutes ? `${minutes} min` : "",
    recipe.servings ? `serves ${recipe.servings}` : "",
    recipe.favorite ? "favorite" : "",
    recipe.rating.mine ? `rated ${recipe.rating.mine}/5` : "",
    recipe.cookCount
      ? `cooked ${recipe.cookCount}x${recipe.lastCooked ? `, last ${recipe.lastCooked}` : ""}`
      : "never cooked",
    `ingredients: ${recipe.ingredients
      .slice(0, 15)
      .map((i) => i.name)
      .join(", ")}`,
  ].filter(Boolean);

  return `${key} | ${recipe.title.replace(/\s+/g, " ")} | ${facts.join(" | ")}`;
};

/**
 * keeps only meals that land on a requested day and meal, use a recipe from
 * the library, and don't double up a slot. Exported for tests.
 */
export const toMealPlan = (
  value: z.infer<typeof mealPlanOutput>,
  keys: Map<string, string>,
  wanted: Map<string, Set<PlanSlot>>
) => {
  const taken = new Set<string>();
  const meals: PlannedMeal[] = [];

  for (const meal of value.meals) {
    const day = meal.day.trim();
    const slot = meal.slot.trim().toLowerCase() as PlanSlot;
    const recipeId = keys.get(meal.recipe.trim().toLowerCase());
    if (!recipeId || !wanted.get(day)?.has(slot)) continue;
    if (taken.has(`${day} ${slot}`)) continue;

    taken.add(`${day} ${slot}`);
    meals.push({ day, slot, recipeId, why: clip(meal.why, 200) });
  }

  return { meals, summary: clip(value.summary, 600) };
};

const planPrompt = `You plan meals for a home cook from the recipes they already have in their recipe app.
Fill the requested days and meals with recipes from <recipes>, referring to each by its key (r1, r2, ...). Never invent a recipe.
- Follow the cook's notes first.
- Fit each recipe to the meal: breakfast recipes for breakfast, lighter dishes or leftovers-friendly ones for lunch, mains for dinner, snacks for snack. Leave a meal out rather than force a recipe that doesn't suit it.
- Vary the week: avoid repeating a recipe, a main protein, or a cuisine on back-to-back days, unless there are too few recipes to do otherwise.
- Use up pantry items, especially ones with a use-by date soon, and favor recipes that share ingredients so the shopping list stays short.
- Lean toward favorites and well-rated dishes, mix in a few that haven't been cooked lately or ever, and keep weeknight dinners quicker than weekend ones.
- Keep what's already planned in mind for variety; don't replace it.
For each meal give a short reason (under 15 words), such as "uses the spinach before Thursday" or "quick after a long Monday".
The summary is one or two plain sentences about the shape of the plan.`;

const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

export const planMeals = async (input: {
  today: string;
  recipes: PlannerRecipe[];
  pantry: { name: string; expiresOn: string | null }[];
  planned: { day: string; slot: string; title: string }[];
  fill: { day: string; slots: PlanSlot[] }[];
  notes: string;
}) => {
  if (!aiEnabled())
    return { ok: false, error: "AI is not set up on this server" };

  const chosen = plannerRecipes(input.recipes);
  const keys = new Map(chosen.map((r, i) => [`r${i + 1}`, r.id]));
  const wanted = new Map(input.fill.map((e) => [e.day, new Set(e.slots)]));

  const recipeList = chosen
    .map((r, i) => recipeLine(r, `r${i + 1}`))
    .join("\n");

  const pantry = input.pantry
    .slice(0, 150)
    .map((i) => `- ${i.name}${i.expiresOn ? ` (use by ${i.expiresOn})` : ""}`)
    .join("\n");

  const planned = input.planned
    .map((e) => `- ${e.day} ${e.slot}: ${e.title}`)
    .join("\n");

  const fill = input.fill
    .map((e) => `- ${e.day} (${weekday(e.day)}): ${e.slots.join(", ")}`)
    .join("\n");

  const notes = input.notes.trim();

  const content = [
    `<recipes>\n${recipeList}\n</recipes>`,
    `<pantry>\n${pantry || "(empty)"}\n</pantry>`,
    `<already_planned>\n${planned || "(nothing)"}\n</already_planned>`,
    `Today is ${input.today} (${weekday(input.today)}).`,
    `<fill>\n${fill}\n</fill>`,
    notes ? `<notes>\n${notes}\n</notes>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const output = await objectFrom(mealPlanOutput, planPrompt, content);
    if (!output)
      return { ok: false, error: "The model's answer could not be read" };

    const plan = toMealPlan(output, keys, wanted);

    if (!plan.meals.length)
      return {
        ok: false,
        error: "Couldn't find recipes that fit. Try different meals or notes.",
      };

    return { ok: true, value: plan };
  } catch (error) {
    return failure(error);
  }
};
