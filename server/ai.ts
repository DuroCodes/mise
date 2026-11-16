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
        "You help a home cook with one recipe: ingredient substitutions, swaps for allergies or diets, and what to do when they are missing something. Answer in plain text (no Markdown headings or tables), in a few short sentences or a short list. Say how a swap changes the dish and adjust amounts when that matters. If a swap would not work, say so.",
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
