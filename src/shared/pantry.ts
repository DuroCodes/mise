import { matchFood, tokens } from "./nutrition";

/** Things nearly every kitchen has; they never count as "missing". */
const staples = new Set(
  ["salt", "kosher salt", "sea salt", "flaky salt", "black pepper", "pepper",
    "ground pepper", "salt and pepper", "salt and black pepper", "water", "ice",
    "ice water", "hot water", "cold water", "warm water"].map((name) =>
    tokens(name).join(" ")
  )
);

export const isStaple = (name: string) => staples.has(tokens(name).join(" "));

const isOptional = (note: string) => /\boptional\b/i.test(note);

const contains = (haystack: string[], needle: string[]) => {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, index) => haystack[start + index] === word))
      return true;
  }
  return false;
};

/**
 * Whether a pantry item covers a recipe ingredient. When both are in the food
 * table they must be the same food ("chicken" does not cover "chicken stock",
 * but "chicken broth" covers "chicken stock"); otherwise the pantry item's
 * words have to appear in the ingredient ("eggs" covers "large eggs").
 */
export const covers = (pantryName: string, ingredientName: string) => {
  const have = tokens(pantryName);
  const need = tokens(ingredientName);
  if (have.length === 0 || need.length === 0) return false;
  const haveFood = matchFood(pantryName);
  const needFood = matchFood(ingredientName);
  if (haveFood && needFood) return haveFood === needFood;
  return contains(need, have) || contains(have, need);
};

export type Match<R> = {
  recipe: R;
  have: string[];
  missing: string[];
  expiring: string[];
  coverage: number;
};

type Recipe = {
  ingredients: { name: string; note: string }[];
};

type PantryEntry = { name: string; expiresOn: string | null };

/**
 * Ranks recipes by how much of them the pantry covers. Staples and optional
 * ingredients are ignored. Items expiring within `soonDays` are reported so
 * the page can say "uses up your spinach".
 */
export const rankRecipes = <R extends Recipe>(
  recipes: R[],
  pantry: PantryEntry[],
  today: string,
  soonDays = 3
): Match<R>[] => {
  const soonLimit = new Date(`${today}T00:00:00Z`);
  soonLimit.setUTCDate(soonLimit.getUTCDate() + soonDays);
  const soon = soonLimit.toISOString().slice(0, 10);

  const matches: Match<R>[] = [];
  for (const recipe of recipes) {
    const needed = recipe.ingredients.filter(
      (item) => !isStaple(item.name) && !isOptional(item.note)
    );
    if (needed.length === 0) continue;
    const have: string[] = [];
    const missing: string[] = [];
    const expiring = new Set<string>();
    for (const item of needed) {
      const hits = pantry.filter((entry) => covers(entry.name, item.name));
      if (hits.length === 0) {
        missing.push(item.name);
        continue;
      }
      have.push(item.name);
      for (const hit of hits)
        if (hit.expiresOn && hit.expiresOn <= soon) expiring.add(hit.name);
    }
    if (have.length === 0) continue;
    matches.push({
      recipe,
      have,
      missing,
      expiring: [...expiring],
      coverage: have.length / needed.length,
    });
  }
  return matches.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.expiring.length - a.expiring.length ||
      a.missing.length - b.missing.length
  );
};
