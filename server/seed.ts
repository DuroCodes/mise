import type { RecipeInput } from "../src/shared/recipe";
import { createRecipe, hasRecipes } from "./db";

const examples: RecipeInput[] = [
  {
    title: "Cacio e pepe",
    description:
      "Pecorino, black pepper, and pasta water. Take the pan off the heat before the cheese goes in so the sauce stays silky.",
    image: null,
    sourceUrl: null,
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
    title: "Tomato pasta",
    description:
      "A quick skillet sauce over spaghetti. Dinner in about 25 minutes.",
    image: null,
    sourceUrl: null,
    prepMinutes: 5,
    cookMinutes: 20,
    servings: 4,
    favorite: false,
    visibility: "public",
    tags: ["pasta", "weeknight"],
    ingredients: [
      { amount: "400", unit: "g", name: "spaghetti", note: "" },
      { amount: "2", unit: "tbsp", name: "olive oil", note: "" },
      { amount: "3", unit: "cloves", name: "garlic", note: "sliced" },
      { amount: "1", unit: "can (28 oz)", name: "crushed tomatoes", note: "" },
      { amount: "", unit: "", name: "salt and black pepper", note: "" },
      {
        amount: "",
        unit: "",
        name: "basil or parsley",
        note: "for serving",
      },
    ],
    instructions: [
      {
        text: "Boil the spaghetti in salted water until just shy of done, about 9 minutes. Save a cup of the pasta water.",
      },
      {
        text: "Warm the oil in a wide skillet. Cook the garlic until fragrant, about 1 minute.",
      },
      {
        text: "Add the tomatoes, salt, and pepper. Simmer until the sauce thickens a little, about 10 minutes.",
      },
      {
        text: "Toss in the drained pasta with a splash of pasta water until it coats the noodles.",
      },
      { text: "Scatter with herbs and serve." },
    ],
  },
  {
    title: "Miso soup",
    description: "Dashi, soft tofu, and wakame. Keep the miso below a boil.",
    image: null,
    sourceUrl: null,
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
