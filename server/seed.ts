import type { RecipeInput } from "../src/shared/recipe";
import { createRecipe, hasRecipes } from "./db";

const examples: RecipeInput[] = [
  {
    title: "Cacio e pepe",
    description:
      "Pecorino, black pepper, and pasta water. Take the pan off the heat before the cheese goes in so the sauce stays silky.",
    image: null,
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    favorite: true,
    visibility: "public",
    tags: ["pasta", "weeknight"],
    ingredients: [
      { amount: "400", unit: "g", name: "spaghetti", note: "" },
      {
        amount: "200",
        unit: "g",
        name: "Pecorino Romano",
        note: "finely grated",
      },
      {
        amount: "2",
        unit: "tsp",
        name: "black pepper",
        note: "coarsely ground",
      },
      {
        amount: "",
        unit: "",
        name: "kosher salt",
        note: "for the pasta water",
      },
    ],
    instructions: [
      {
        text: "Toast the pepper in a wide skillet over medium heat until it smells fragrant.",
      },
      {
        text: "Boil the spaghetti in lightly salted water. Before draining, reserve 2 cups of the pasta water.",
      },
      {
        text: "Add the drained pasta to the skillet with the pepper and a ladle of pasta water. Toss until the pasta is glossy.",
      },
      {
        text: "Take the pan off the heat. Add the pecorino in handfuls, tossing and splashing in pasta water until the sauce coats the noodles.",
      },
      { text: "Serve right away, with more pecorino and pepper on top." },
    ],
  },
  {
    title: "Shakshuka",
    description: "Eggs poached in a skillet of pepper, cumin, and tomatoes.",
    image: null,
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 4,
    favorite: false,
    visibility: "public",
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
      {
        amount: "",
        unit: "",
        name: "cilantro or parsley",
        note: "for serving",
      },
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
  },
  {
    title: "Miso soup",
    description: "Dashi, soft tofu, and wakame. Keep the miso below a boil.",
    image: null,
    prepMinutes: 10,
    cookMinutes: 10,
    servings: 4,
    favorite: false,
    visibility: "public",
    tags: ["soup", "japanese"],
    ingredients: [
      { amount: "4", unit: "cups", name: "dashi", note: "" },
      { amount: "3", unit: "tbsp", name: "white miso", note: "" },
      { amount: "8", unit: "oz", name: "soft tofu", note: "cubed" },
      { amount: "2", unit: "tbsp", name: "dried wakame", note: "" },
      { amount: "2", unit: "", name: "scallions", note: "sliced" },
    ],
    instructions: [
      { text: "Soak the wakame in cold water for 5 minutes, then drain it." },
      {
        text: "Bring the dashi to a bare simmer. Add the tofu and wakame and warm them through.",
      },
      {
        text: "Ladle a little dashi into the miso and stir until smooth, then pour it back into the pot.",
      },
      {
        text: "Take the pot off the heat before it boils. Serve with the scallions.",
      },
    ],
  },
];

export const seedIfEmpty = () => {
  if (hasRecipes()) return;
  for (const recipe of [...examples].reverse()) createRecipe(recipe, null);
};
