import { z } from "zod";

const cleanTags = (tags: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const tag of tags) {
    const name = tag.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
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

export const recipeSchema = recipeInput.extend({
  id: z.string(),
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  canEdit: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RecipeInput = z.infer<typeof recipeInput>;
export type Ingredient = z.infer<typeof ingredientInput>;
export type Recipe = z.infer<typeof recipeSchema>;
