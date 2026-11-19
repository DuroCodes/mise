import { z } from "zod";

const reservedTags = new Set(["favorites"]);

/** the library already uses this word for the favorite filter. */
export const isReservedTag = (name: string) =>
  reservedTags.has(name.trim().toLowerCase().replace(/\s+/g, " "));

const cleanTags = (tags: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const tag of tags) {
    const name = tag.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key) || reservedTags.has(key)) continue;
    seen.add(key);
    next.push(key);
  }

  return next;
};

const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable();

const image = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value.startsWith("/uploads/") || /^https?:\/\//i.test(value),
    "Use an uploaded image or an http(s) link"
  );

export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "Use an http(s) link");

export const ingredientInput = z.object({
  amount: z.string().trim().max(40).default(""),
  unit: z.string().trim().max(40).default(""),
  name: z.string().trim().min(1, "Add an ingredient name").max(200),
  note: z.string().trim().max(200).default(""),
});

export const instructionInput = z.object({
  text: z.string().trim().min(1, "Write the step").max(2000),
});

export const recipeInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(200),
  description: z.string().trim().max(4000).default(""),
  image: z.union([image, z.null()]).default(null),
  sourceUrl: z.union([httpUrl, z.null()]).default(null),
  prepMinutes: minutes.default(null),
  cookMinutes: minutes.default(null),
  servings: z.number().int().min(1).max(999).nullable().default(null),
  favorite: z.boolean().default(false),
  visibility: z.enum(["private", "public"]).default("private"),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .default([])
    .transform(cleanTags),
  ingredients: z.array(ingredientInput).max(80).default([]),
  instructions: z.array(instructionInput).max(80).default([]),
});

export const ratingSummary = z.object({
  average: z.number().nullable(),
  count: z.number(),
  mine: z.number().nullable(),
});

export const recipeSchema = recipeInput.extend({
  id: z.string(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  canEdit: z.boolean(),
  shareToken: z.string().nullable(),
  rating: ratingSummary,
  lastCooked: z.string().nullable(),
  cookCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sharedRecipeSchema = recipeInput
  .omit({ favorite: true, visibility: true })
  .extend({ ownerName: z.string().nullable() });

export type RecipeInput = z.infer<typeof recipeInput>;
export type Ingredient = z.infer<typeof ingredientInput>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RatingSummary = z.infer<typeof ratingSummary>;
export type SharedRecipe = z.infer<typeof sharedRecipeSchema>;

export const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Use a real date");
