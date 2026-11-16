import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { recipeInput, type Recipe, type RecipeInput } from "../src/shared/recipe";

/**
 * Optional Claude features. They stay off unless the server has
 * ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) set, so recipes never leave the
 * machine unless the person running mise opts in.
 */
export const aiEnabled = () =>
  Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.ANTHROPIC_AUTH_TOKEN?.trim()
  );

const model = () => process.env.MISE_AI_MODEL?.trim() || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => {
  client ??= new Anthropic();
  return client;
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
export const toRecipeInput = (value: Extracted): RecipeInput | null => {
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

const failure = (error: unknown): { ok: false; error: string } => {
  console.error(error);
  if (error instanceof Anthropic.AuthenticationError)
    return { ok: false, error: "The Claude API key was rejected" };
  if (error instanceof Anthropic.RateLimitError)
    return { ok: false, error: "Claude is busy. Try again in a minute." };
  if (error instanceof Anthropic.APIError)
    return { ok: false, error: "Claude could not answer that right now" };
  return { ok: false, error: "Could not reach Claude" };
};

export const extractRecipe = async (input: {
  text: string;
  image: { data: string; mediaType: AiImageType } | null;
}): Promise<AiResult<RecipeInput>> => {
  if (!aiEnabled()) return { ok: false, error: "AI is not set up on this server" };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.image.mediaType,
        data: input.image.data,
      },
    });
  }
  content.push({
    type: "text",
    text: input.text.trim()
      ? `<recipe>\n${input.text.trim()}\n</recipe>`
      : "The recipe is in the image.",
  });

  try {
    const response = await anthropic().beta.messages.parse({
      model: model(),
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(extracted) },
      system: extractionPrompt,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal")
      return { ok: false, error: "Claude declined to read that" };
    if (response.stop_reason === "max_tokens")
      return { ok: false, error: "That recipe was too long to read in one go" };
    const output = response.parsed_output;
    if (!output) return { ok: false, error: "Claude's answer could not be read" };
    const recipe = toRecipeInput(output);
    if (!recipe) return { ok: false, error: "No recipe was found in that" };
    return { ok: true, value: recipe };
  } catch (error) {
    return failure(error);
  }
};

const photoItems = z.object({
  items: z.array(z.object({ name: z.string(), amount: z.string(), unit: z.string() })),
});

export type PhotoItem = { name: string; amount: string; unit: string };

/** Fits model output to pantry limits. Exported for tests. */
export const toPhotoItems = (value: z.infer<typeof photoItems>): PhotoItem[] => {
  const seen = new Set<string>();
  const out: PhotoItem[] = [];
  for (const item of value.items) {
    const name = clip(item.name, 200).toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, amount: clip(item.amount, 40), unit: clip(item.unit, 40) });
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
}): Promise<AiResult<PhotoItem[]>> => {
  if (!aiEnabled()) return { ok: false, error: "AI is not set up on this server" };
  try {
    const response = await anthropic().beta.messages.parse({
      model: model(),
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(photoItems) },
      system: photoPrompts[input.kind],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.image.mediaType, data: input.image.data },
            },
            { type: "text", text: input.kind === "receipt" ? "Here's my receipt." : "Here's what I have." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal")
      return { ok: false, error: "Claude declined to read that" };
    const output = response.parsed_output;
    if (!output) return { ok: false, error: "Claude's answer could not be read" };
    const items = toPhotoItems(output);
    if (items.length === 0)
      return { ok: false, error: input.kind === "receipt" ? "No groceries found on that receipt" : "No food found in that photo" };
    return { ok: true, value: items };
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
export const parseFound = (text: string, searched: Set<string>): FoundRecipe[] => {
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
      uses: item.uses.map((use) => clip(use, 60)).filter(Boolean).slice(0, 12),
    });
    if (out.length >= 6) break;
  }
  return out;
};

const findPrompt = `You find real recipes on the web for a home cook who wants to use what's in their pantry.
Use web search. Pick individual recipe pages (not roundups or listicles) from sites that publish a full ingredient list, since each one will be imported into a recipe app.
Prefer recipes that use several of the pantry items and need few extra ingredients.
Finish with only a JSON array in a \`\`\`json code block, 3 to 6 items, each:
{"title": "...", "url": "the exact page URL from your search results", "why": "one short sentence on why it fits", "uses": ["pantry items it uses"]}`;

export const findRecipes = async (
  pantry: string[],
  focus: string
): Promise<AiResult<FoundRecipe[]>> => {
  if (!aiEnabled()) return { ok: false, error: "AI is not set up on this server" };
  const list = pantry.slice(0, 80).map((name) => `- ${name}`).join("\n");
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `<pantry>\n${list}\n</pantry>${focus.trim() ? `\n\nWhat I'm in the mood for: ${focus.trim()}` : ""}`,
    },
  ];
  const searched = new Set<string>();

  try {
    for (let round = 0; round < 4; round += 1) {
      const response = await anthropic().beta.messages.create({
        model: model(),
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: findPrompt,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      });
      for (const block of response.content) {
        if (block.type !== "web_search_tool_result" || !Array.isArray(block.content))
          continue;
        for (const result of block.content) {
          const url = normalizeUrl(result.url);
          if (url) searched.add(url);
        }
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal")
        return { ok: false, error: "Claude declined to search for that" };
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const found = parseFound(text, searched);
      if (found.length === 0)
        return { ok: false, error: "Claude couldn't find recipes this time. Try again or change the focus." };
      return { ok: true, value: found };
    }
    return { ok: false, error: "The search took too long. Try again." };
  } catch (error) {
    return failure(error);
  }
};

export const askAboutRecipe = async (
  recipe: Pick<Recipe, "title" | "servings" | "ingredients" | "instructions">,
  question: string
): Promise<AiResult<string>> => {
  if (!aiEnabled()) return { ok: false, error: "AI is not set up on this server" };
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
    const response = await anthropic().beta.messages.create({
      model: model(),
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system:
        "You help a home cook with one recipe: ingredient substitutions, swaps for allergies or diets, and what to do when they are missing something. Answer in short Markdown: one opening sentence, then a bulleted list where each item starts with the swap in bold, followed by how to use it. Use only bold, italics, and lists (no headings, tables, links, or code). For a simple yes/no question, a sentence or two is enough. Say how a swap changes the dish and adjust amounts when that matters. If a swap would not work, say so.",
      messages: [
        {
          role: "user",
          content: `<recipe title="${recipe.title.replace(/"/g, "'")}" servings="${recipe.servings ?? "unknown"}">\n<ingredients>\n${ingredients}\n</ingredients>\n<steps>\n${steps}\n</steps>\n</recipe>\n\n${question.trim()}`,
        },
      ],
    });
    if (response.stop_reason === "refusal")
      return { ok: false, error: "Claude declined to answer that" };
    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!answer) return { ok: false, error: "Claude did not answer" };
    return { ok: true, value: answer };
  } catch (error) {
    return failure(error);
  }
};
