import type { SharedRecipe } from "@/shared/recipe";
import { combineQuantities, itemKey } from "@/shared/shopping";
import type { StoreSection } from "@/shared/stores";

/**
 * the recipes the demos run on. the first three are the ones a fresh install
 * starts with (server/seed.ts); the last two fill out the week.
 */
const recipe = (
  value: Omit<SharedRecipe, "image" | "sourceUrl" | "ownerName">
) => ({
  ...value,
  image: null,
  sourceUrl: null,
  ownerName: null,
});

export const shakshuka = recipe({
  title: "Shakshuka",
  description: "Eggs poached in a skillet of pepper, cumin, and tomatoes.",
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  tags: ["eggs", "dinner"],
  ingredients: [
    { amount: "2", unit: "tbsp", name: "olive oil", note: "" },
    { amount: "1", unit: "", name: "yellow onion", note: "thinly sliced" },
    { amount: "1", unit: "", name: "red bell pepper", note: "sliced" },
    { amount: "3", unit: "cloves", name: "garlic", note: "minced" },
    { amount: "1", unit: "tsp", name: "ground cumin", note: "" },
    { amount: "1", unit: "tsp", name: "paprika", note: "" },
    { amount: "1", unit: "can (28 oz)", name: "crushed tomatoes", note: "" },
    { amount: "4", unit: "", name: "eggs", note: "" },
    { amount: "", unit: "", name: "salt and black pepper", note: "" },
    { amount: "", unit: "", name: "cilantro or parsley", note: "for serving" },
  ],
  instructions: [
    {
      text: "Warm the oil in a skillet over medium heat. Cook the onion and pepper until soft, about 8 minutes.",
    },
    { text: "Stir in the garlic, cumin, and paprika and cook for 1 minute." },
    {
      text: "Add the tomatoes, salt, and pepper. Simmer until the sauce thickens slightly, about 10 minutes.",
    },
    {
      text: "Make four wells and crack an egg into each. Cover and cook until the whites set, 5 to 7 minutes.",
    },
    { text: "Scatter with herbs and serve with bread." },
  ],
});

export const cacioEPepe = recipe({
  title: "Cacio e pepe",
  description:
    "Pecorino, black pepper, and pasta water. Take the pan off the heat before the cheese goes in so the sauce stays silky.",
  prepMinutes: 10,
  cookMinutes: 15,
  servings: 4,
  tags: ["pasta", "weeknight"],
  ingredients: [
    { amount: "400", unit: "g", name: "spaghetti", note: "" },
    {
      amount: "200",
      unit: "g",
      name: "Pecorino Romano",
      note: "finely grated",
    },
    { amount: "2", unit: "tsp", name: "black pepper", note: "coarsely ground" },
    { amount: "", unit: "", name: "kosher salt", note: "for the pasta water" },
  ],
  instructions: [],
});

export const misoSoup = recipe({
  title: "Miso soup",
  description: "Dashi, soft tofu, and wakame. Keep the miso below a boil.",
  prepMinutes: 10,
  cookMinutes: 10,
  servings: 4,
  tags: ["soup", "japanese"],
  ingredients: [
    { amount: "4", unit: "cups", name: "dashi", note: "" },
    { amount: "3", unit: "tbsp", name: "white miso", note: "" },
    { amount: "8", unit: "oz", name: "soft tofu", note: "cubed" },
    { amount: "2", unit: "tbsp", name: "dried wakame", note: "" },
    { amount: "2", unit: "", name: "scallions", note: "sliced" },
  ],
  instructions: [],
});

export const friedRice = recipe({
  title: "Egg fried rice",
  description: "Day-old rice, eggs, and whatever is in the freezer.",
  prepMinutes: 10,
  cookMinutes: 10,
  servings: 2,
  tags: ["rice", "weeknight"],
  ingredients: [
    { amount: "3", unit: "cups", name: "cooked rice", note: "cold" },
    { amount: "2", unit: "", name: "eggs", note: "" },
    { amount: "1", unit: "cup", name: "frozen peas", note: "" },
    { amount: "2", unit: "", name: "scallions", note: "sliced" },
    { amount: "2", unit: "tbsp", name: "soy sauce", note: "" },
    { amount: "1", unit: "tbsp", name: "olive oil", note: "" },
  ],
  instructions: [],
});

export const roastChicken = recipe({
  title: "Lemon roast chicken",
  description: "One pan, with the potatoes underneath.",
  prepMinutes: 15,
  cookMinutes: 75,
  servings: 4,
  tags: ["chicken", "sunday"],
  ingredients: [
    { amount: "1", unit: "", name: "whole chicken", note: "about 1.8 kg" },
    { amount: "750", unit: "g", name: "potatoes", note: "halved" },
    { amount: "2", unit: "", name: "lemons", note: "" },
    { amount: "1", unit: "", name: "yellow onion", note: "in wedges" },
    { amount: "1", unit: "tbsp", name: "olive oil", note: "" },
    { amount: "4", unit: "sprigs", name: "thyme", note: "" },
  ],
  instructions: [],
});

export const recipes = [
  shakshuka,
  cacioEPepe,
  misoSoup,
  friedRice,
  roastChicken,
];

/** the week on the plan card: day offset from Monday, meal, recipe. */
export const week: { day: number; slot: string; recipe: SharedRecipe }[] = [
  { day: 1, slot: "Dinner", recipe: shakshuka },
  { day: 3, slot: "Dinner", recipe: friedRice },
  { day: 6, slot: "Dinner", recipe: roastChicken },
];

export type ListItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  note: string;
  sources: string[];
};

/**
 * joins lines into a list the way the server does (server/shopping.ts): a line
 * joins an existing one with the same name when the amounts can honestly be
 * added, and stays separate otherwise.
 */
export const mergeInto = (
  list: ListItem[],
  lines: { name: string; amount: string; unit: string }[],
  source: string
) => {
  const next = list.map((item) => ({ ...item, sources: [...item.sources] }));
  for (const line of lines) {
    const key = itemKey(line.name);
    let merged = false;
    for (const item of next) {
      if (itemKey(item.name) !== key) continue;
      const sum = combineQuantities(
        { amount: item.amount, unit: item.unit },
        { amount: line.amount, unit: line.unit }
      );
      if (!sum) continue;
      item.amount = sum.amount;
      item.unit = sum.unit;
      if (!item.sources.includes(source)) item.sources.push(source);
      merged = true;
      break;
    }
    if (merged) continue;
    next.push({
      id: `item-${next.length}-${key}`,
      name: line.name,
      amount: line.amount,
      unit: line.unit,
      note: "",
      sources: [source],
    });
  }
  return next;
};

/** the shopping list for the week on the plan card. */
export const weekList = () => {
  let list: ListItem[] = [];
  for (const planned of new Set(week.map((entry) => entry.recipe)))
    list = mergeInto(list, planned.ingredients, planned.title);
  return list;
};

export const stores: { id: string; name: string; layout: StoreSection[] }[] = [
  {
    id: "market",
    name: "Greenway Market",
    layout: [
      { aisle: "Bakery", label: "by the door" },
      { aisle: "Produce", label: "" },
      { aisle: "Dairy & Eggs", label: "aisle 2" },
      { aisle: "Pantry", label: "aisle 4" },
      { aisle: "Spices & Seasonings", label: "aisle 5" },
      { aisle: "Condiments & Sauces", label: "aisle 5" },
      { aisle: "Meat & Seafood", label: "back wall" },
      { aisle: "Frozen", label: "last" },
    ],
  },
  {
    id: "coop",
    name: "Corner co-op",
    layout: [
      { aisle: "Frozen", label: "" },
      { aisle: "Meat & Seafood", label: "" },
      { aisle: "Pantry", label: "shelves 1-3" },
      { aisle: "Condiments & Sauces", label: "shelf 4" },
      { aisle: "Spices & Seasonings", label: "shelf 4" },
      { aisle: "Dairy & Eggs", label: "" },
      { aisle: "Produce", label: "at the till" },
    ],
  },
];

/** what's in the house, with days until each use-by date (null: it keeps). */
export const pantry: {
  name: string;
  amount: string;
  unit: string;
  days: number | null;
}[] = [
  { name: "eggs", amount: "6", unit: "", days: 9 },
  { name: "soft tofu", amount: "8", unit: "oz", days: 2 },
  { name: "scallions", amount: "1", unit: "bunch", days: 1 },
  { name: "cooked rice", amount: "3", unit: "cups", days: 3 },
  { name: "frozen peas", amount: "1", unit: "package", days: null },
  { name: "soy sauce", amount: "", unit: "", days: null },
  { name: "olive oil", amount: "", unit: "", days: null },
  { name: "white miso", amount: "", unit: "", days: null },
  { name: "spaghetti", amount: "500", unit: "g", days: null },
  { name: "garlic", amount: "1", unit: "head", days: null },
  { name: "yellow onions", amount: "3", unit: "", days: null },
];
