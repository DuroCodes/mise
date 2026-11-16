import { describe, expect, test } from "bun:test";
import { gzipSync, strToU8, zipSync } from "fflate";
import { formatAmount, parseAmount, scaleIngredient } from "../src/lib/units";
import { aisleFor } from "../src/shared/aisles";
import { estimateNutrition, gramsFor, matchFood } from "../src/shared/nutrition";
import { combineQuantities, itemKey } from "../src/shared/shopping";
import { findTimers, formatClock } from "../src/shared/timers";
import { covers, isStaple, matchListItem, rankRecipes } from "../src/shared/pantry";
import { parseFound, toRecipeInput } from "./ai";
import {
  gunzipLimited,
  minutesFromText,
  readImportFile,
  sniffImage,
} from "./import-file";

describe("units", () => {
  test("parses fractions and mixed numbers", () => {
    expect(parseAmount("1/2")).toBe(0.5);
    expect(parseAmount("1 1/2")).toBe(1.5);
    expect(parseAmount("½")).toBe(0.5);
    expect(parseAmount("2½")).toBe(2.5);
    expect(parseAmount("a pinch")).toBeNull();
  });

  test("formats friendly amounts", () => {
    expect(formatAmount(0.5)).toBe("1/2");
    expect(formatAmount(1.25)).toBe("1 1/4");
    expect(formatAmount(2)).toBe("2");
    expect(formatAmount(150)).toBe("150");
  });

  test("scales and converts", () => {
    expect(scaleIngredient({ amount: "200", unit: "g" }, 2, "original")).toEqual({
      amount: "400",
      unit: "g",
    });
    const imperial = scaleIngredient({ amount: "454", unit: "g" }, 1, "imperial");
    expect(imperial.unit).toBe("lb");
    expect(imperial.amount).toBe("1");
    const metric = scaleIngredient({ amount: "1", unit: "cup" }, 1, "metric");
    expect(metric).toEqual({ amount: "237", unit: "ml" });
  });
});

describe("shopping list merging", () => {
  test("normalizes names, including simple plurals", () => {
    expect(itemKey("Tomatoes")).toBe(itemKey("tomato"));
    expect(itemKey("eggs")).toBe(itemKey("egg"));
    expect(itemKey("berries")).toBe(itemKey("berry"));
    expect(itemKey("Pecorino Romano (grated)")).toBe("pecorino romano");
    expect(itemKey("glass")).toBe("glass");
  });

  test("adds the same unit", () => {
    expect(
      combineQuantities({ amount: "200", unit: "g" }, { amount: "100", unit: "g" })
    ).toEqual({ amount: "300", unit: "g" });
    expect(
      combineQuantities({ amount: "1", unit: "can" }, { amount: "2", unit: "cans" })
    ).toEqual({ amount: "3", unit: "can" });
    expect(
      combineQuantities({ amount: "2", unit: "" }, { amount: "4", unit: "" })
    ).toEqual({ amount: "6", unit: "" });
  });

  test("converts compatible units", () => {
    expect(
      combineQuantities({ amount: "1", unit: "kg" }, { amount: "500", unit: "g" })
    ).toEqual({ amount: "1 1/2", unit: "kg" });
    expect(
      combineQuantities({ amount: "1", unit: "cup" }, { amount: "1", unit: "cup" })
    ).toEqual({ amount: "2", unit: "cups" });
    expect(
      combineQuantities({ amount: "1/2", unit: "cup" }, { amount: "4", unit: "tbsp" })
    ).toEqual({ amount: "3/4", unit: "cups" });
  });

  test("refuses to add things that do not add up", () => {
    expect(
      combineQuantities({ amount: "2", unit: "cloves" }, { amount: "1", unit: "head" })
    ).toBeNull();
    expect(
      combineQuantities({ amount: "200", unit: "g" }, { amount: "1", unit: "cup" })
    ).toBeNull();
    expect(
      combineQuantities({ amount: "2-3", unit: "" }, { amount: "1", unit: "" })
    ).toBeNull();
    expect(
      combineQuantities({ amount: "", unit: "" }, { amount: "1", unit: "tsp" })
    ).toBeNull();
    expect(
      combineQuantities({ amount: "", unit: "" }, { amount: "", unit: "" })
    ).toEqual({ amount: "", unit: "" });
  });
});

describe("store aisles", () => {
  test("sorts the potato soup list sensibly", () => {
    const expected: Record<string, string> = {
      "yellow onion": "Produce",
      "celery stalks": "Produce",
      garlic: "Produce",
      bacon: "Meat & seafood",
      butter: "Dairy & eggs",
      "all-purpose flour": "Baking",
      "chicken stock": "Pantry",
      "whole milk": "Dairy & eggs",
      "heavy cream": "Dairy & eggs",
      "russet potatoes": "Produce",
      "cheddar cheese": "Dairy & eggs",
      "green onions": "Produce",
      "salt and black pepper": "Spices & seasonings",
    };
    for (const [name, aisle] of Object.entries(expected))
      expect(`${name}: ${aisleFor(name)}`).toBe(`${name}: ${aisle}`);
  });

  test("prefers the most specific phrase", () => {
    expect(aisleFor("garlic powder")).toBe("Spices & seasonings");
    expect(aisleFor("peanut butter")).toBe("Pantry");
    expect(aisleFor("coconut milk")).toBe("Pantry");
    expect(aisleFor("crushed tomatoes")).toBe("Pantry");
    expect(aisleFor("cherry tomatoes")).toBe("Produce");
    expect(aisleFor("red pepper flakes")).toBe("Spices & seasonings");
    expect(aisleFor("olive oil")).toBe("Condiments & sauces");
    expect(aisleFor("frozen corn")).toBe("Frozen");
    expect(aisleFor("Panko bread crumbs")).toBe("Pantry");
    expect(aisleFor("unobtainium")).toBe("Other");
  });
});

describe("pantry matching", () => {
  test("covers the right ingredients", () => {
    expect(covers("eggs", "large eggs")).toBe(true);
    expect(covers("onions", "yellow onion")).toBe(true);
    expect(covers("chicken broth", "chicken stock")).toBe(true);
    expect(covers("parmesan", "Parmigiano Reggiano")).toBe(true);
    expect(covers("chicken", "chicken stock")).toBe(false);
    expect(covers("garlic", "garlic powder")).toBe(false);
    expect(covers("butter", "peanut butter")).toBe(false);
    expect(covers("gochujang", "gochujang paste")).toBe(true);
    expect(covers("", "eggs")).toBe(false);
  });

  test("ranks recipes and ignores staples and optional items", () => {
    const soup = {
      id: "soup",
      ingredients: [
        { name: "russet potatoes", note: "" },
        { name: "chicken stock", note: "" },
        { name: "heavy cream", note: "" },
        { name: "salt and black pepper", note: "" },
        { name: "green onions", note: "optional, for garnish" },
      ],
    };
    const toast = {
      id: "toast",
      ingredients: [
        { name: "bread", note: "" },
        { name: "butter", note: "" },
      ],
    };
    const unrelated = { id: "x", ingredients: [{ name: "lobster", note: "" }] };
    const ranked = rankRecipes(
      [soup, toast, unrelated],
      [
        { name: "potatoes", expiresOn: "2026-11-17" },
        { name: "chicken broth", expiresOn: null },
        { name: "bread", expiresOn: "2026-12-30" },
        { name: "butter", expiresOn: null },
      ],
      "2026-11-16"
    );
    expect(ranked.map((match) => match.recipe.id)).toEqual(["toast", "soup"]);
    expect(ranked[0]?.coverage).toBe(1);
    const soupMatch = ranked[1];
    expect(soupMatch?.have).toEqual(["russet potatoes", "chicken stock"]);
    expect(soupMatch?.missing).toEqual(["heavy cream"]);
    expect(soupMatch?.expiring).toEqual(["potatoes"]);
    expect(isStaple("Salt and pepper")).toBe(true);
  });
});

describe("scanning", () => {
  const list = [
    { name: "spaghetti", checked: true },
    { name: "cheddar cheese", checked: false },
    { name: "heavy cream", checked: false },
    { name: "spaghetti", checked: false },
    { name: "chicken", checked: false },
  ];

  test("matches branded products to list items", () => {
    expect(matchListItem("Tillamook Medium Cheddar Cheese", list)?.name).toBe("cheddar cheese");
    expect(matchListItem("Heavy Whipping Cream", list)?.name).toBe("heavy cream");
    expect(matchListItem("Barilla Spaghetti n.5", list)).toBe(list[3]);
    expect(matchListItem("Swanson Chicken Broth", list)).toBeNull();
    expect(matchListItem("Nutella", list)).toBeNull();
  });
});

describe("Claude recipe search results", () => {
  const searched = new Set([
    "https://example.com/soup",
    "https://www.recipes.test/toast",
  ]);

  test("keeps only links that came from the search", () => {
    const text = 'Here you go:\n```json\n[{"title":"Soup","url":"https://example.com/soup/#top","why":"Uses potatoes","uses":["potatoes"]},{"title":"Made up","url":"https://invented.test/x","why":"","uses":[]},{"title":"Soup again","url":"https://example.com/soup","why":"","uses":[]},{"title":"Toast","url":"https://www.recipes.test/toast","uses":["bread"]}]\n```';
    const found = parseFound(text, searched);
    expect(found.map((item) => item.url)).toEqual([
      "https://example.com/soup",
      "https://www.recipes.test/toast",
    ]);
    expect(found[1]?.site).toBe("recipes.test");
    expect(found[1]?.why).toBe("");
  });

  test("handles a bare array, bad JSON, and unsafe links", () => {
    expect(parseFound('[{"title":"T","url":"https://example.com/soup"}]', searched)).toHaveLength(1);
    expect(parseFound("no json here", searched)).toEqual([]);
    expect(parseFound('[{"title":"x","url":"javascript:alert(1)"}]', new Set(["javascript:alert(1)"]))).toEqual([]);
  });
});

describe("step timers", () => {
  test("finds plain durations", () => {
    const [timer] = findTimers("Simmer for 10 minutes, stirring.");
    expect(timer?.seconds).toBe(600);
    expect(timer?.label).toBe("10 minutes");
  });

  test("uses the low end of a range", () => {
    expect(findTimers("Cook until set, 5 to 7 minutes.")[0]?.seconds).toBe(300);
    expect(findTimers("Bake 25-30 min")[0]?.seconds).toBe(1500);
  });

  test("handles hours, compound times, words, and fractions", () => {
    expect(findTimers("Roast 1 hour 30 minutes")[0]?.seconds).toBe(5400);
    expect(findTimers("Rest for an hour")[0]?.seconds).toBe(3600);
    expect(findTimers("Soak 1 1/2 hours")[0]?.seconds).toBe(5400);
    expect(findTimers("toast for 30 seconds")[0]?.seconds).toBe(30);
    expect(findTimers("Let it cool for two minutes")[0]?.seconds).toBe(120);
  });

  test("ignores text without a duration", () => {
    expect(findTimers("Add 2 cups of flour and about 3 eggs.")).toEqual([]);
    expect(findTimers("Preheat to 350 degrees.")).toEqual([]);
  });

  test("formats a clock", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("nutrition estimates", () => {
  test("matches the most specific food", () => {
    expect(matchFood("Pecorino Romano")?.names).toContain("pecorino");
    expect(matchFood("chicken broth")?.names).toContain("chicken broth");
    expect(matchFood("peanut butter")?.names).toContain("peanut butter");
    expect(matchFood("green onions")?.names).toContain("green onion");
    expect(matchFood("unobtainium")).toBeNull();
  });

  test("converts units to grams", () => {
    const flour = matchFood("flour");
    if (!flour) throw new Error("flour missing");
    expect(gramsFor({ amount: "1", unit: "cup" }, flour)).toBeCloseTo(125.4, 0);
    expect(gramsFor({ amount: "200", unit: "g" }, flour)).toBe(200);
    const garlic = matchFood("garlic");
    if (!garlic) throw new Error("garlic missing");
    expect(gramsFor({ amount: "3", unit: "cloves" }, garlic)).toBe(9);
    const tomatoes = matchFood("crushed tomatoes");
    if (!tomatoes) throw new Error("tomatoes missing");
    expect(gramsFor({ amount: "1", unit: "can (28 oz)" }, tomatoes)).toBeCloseTo(793.8, 0);
    const salt = matchFood("salt");
    if (!salt) throw new Error("salt missing");
    expect(gramsFor({ amount: "", unit: "" }, salt)).toBeNull();
  });

  test("estimates a whole recipe per serving", () => {
    const estimate = estimateNutrition(
      [
        { amount: "400", unit: "g", name: "spaghetti", note: "" },
        { amount: "200", unit: "g", name: "Pecorino Romano", note: "" },
        { amount: "2", unit: "tsp", name: "black pepper", note: "" },
        { amount: "", unit: "", name: "kosher salt", note: "" },
        { amount: "1", unit: "", name: "dragon fruit", note: "" },
      ],
      4
    );
    expect(estimate.counted).toEqual(["spaghetti", "Pecorino Romano", "black pepper"]);
    expect(estimate.unmeasured).toEqual(["kosher salt"]);
    expect(estimate.unknown).toEqual(["dragon fruit"]);
    // 400 g pasta (1484) + 200 g pecorino (774) + ~4.5 g pepper (~11)
    expect(estimate.perServing?.kcal).toBeGreaterThan(560);
    expect(estimate.perServing?.kcal).toBeLessThan(575);
  });
});

describe("file imports", () => {
  test("reads durations written by people", () => {
    expect(minutesFromText("15 mins")).toBe(15);
    expect(minutesFromText("1 hr 10 min")).toBe(70);
    expect(minutesFromText("1 hour")).toBe(60);
    expect(minutesFromText("PT45M")).toBe(45);
    expect(minutesFromText("1:30")).toBe(90);
    expect(minutesFromText("overnight")).toBeNull();
  });

  test("imports a Paprika export with a photo", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
    ]);
    const recipe = {
      name: "Pancakes",
      ingredients: "1 1/2 cups flour\n2 tbsp sugar\n\n1 egg",
      directions: "1. Whisk.\n2. Cook on a hot griddle for 2 minutes a side.",
      servings: "4 servings",
      prep_time: "10 mins",
      cook_time: "15 mins",
      categories: ["Breakfast"],
      source_url: "https://example.com/pancakes",
      description: "Fluffy.",
      notes: "Use buttermilk if you have it.",
      photo_data: Buffer.from(png).toString("base64"),
    };
    const archive = zipSync({
      "Pancakes.paprikarecipe": gzipSync(strToU8(JSON.stringify(recipe))),
    });
    const result = readImportFile("My Recipes.paprikarecipes", archive);
    expect(result.skipped).toEqual([]);
    expect(result.recipes).toHaveLength(1);
    const [imported] = result.recipes;
    expect(imported?.recipe.title).toBe("Pancakes");
    expect(imported?.recipe.servings).toBe(4);
    expect(imported?.recipe.prepMinutes).toBe(10);
    expect(imported?.recipe.cookMinutes).toBe(15);
    expect(imported?.recipe.sourceUrl).toBe("https://example.com/pancakes");
    expect(imported?.recipe.tags).toEqual(["breakfast"]);
    expect(imported?.recipe.description).toContain("buttermilk");
    expect(imported?.recipe.ingredients[0]).toEqual({
      amount: "1 1/2",
      unit: "cups",
      name: "flour",
      note: "",
    });
    expect(imported?.recipe.instructions.map((step) => step.text)).toEqual([
      "Whisk.",
      "Cook on a hot griddle for 2 minutes a side.",
    ]);
    expect(imported?.recipe.visibility).toBe("private");
    expect(imported?.image?.extension).toBe("png");
  });

  test("imports Mealie recipe JSON with structured ingredients", () => {
    const mealie = {
      id: "3f2c",
      slug: "tomato-soup",
      name: "Tomato soup",
      description: "Simple.",
      recipeYield: "4 servings",
      prepTime: "10 minutes",
      performTime: "30 minutes",
      orgURL: "https://example.com/soup",
      tags: [{ name: "Soup" }],
      recipeCategory: [{ name: "Dinner" }],
      recipeIngredient: [
        { quantity: 2, unit: { name: "tablespoon" }, food: { name: "olive oil" }, note: "" },
        { quantity: 0.5, unit: null, food: { name: "onion" }, note: "diced" },
        { quantity: 0, food: null, note: "salt to taste", originalText: "" },
      ],
      recipeInstructions: [{ text: "Warm the oil." }, { text: "Simmer 20 minutes." }],
    };
    const result = readImportFile("tomato-soup.json", strToU8(JSON.stringify(mealie)));
    expect(result.skipped).toEqual([]);
    const recipe = result.recipes[0]?.recipe;
    expect(recipe?.title).toBe("Tomato soup");
    expect(recipe?.servings).toBe(4);
    expect(recipe?.cookMinutes).toBe(30);
    expect(recipe?.sourceUrl).toBe("https://example.com/soup");
    expect(recipe?.tags).toEqual(["soup", "dinner"]);
    expect(recipe?.ingredients).toEqual([
      { amount: "2", unit: "tablespoon", name: "olive oil", note: "" },
      { amount: "1/2", unit: "", name: "onion", note: "diced" },
      { amount: "", unit: "", name: "salt to taste", note: "" },
    ]);
  });

  test("imports a Mealie backup database with its images", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
    const database = {
      recipes: [
        {
          id: "r1",
          slug: "toast",
          name: "Toast",
          recipe_yield: "2",
          prep_time: "1 minute",
          perform_time: "3 minutes",
          org_url: null,
        },
      ],
      ingredient_units: [{ id: "u1", name: "slice" }],
      ingredient_foods: [{ id: "f1", name: "bread" }],
      recipes_ingredients: [
        { recipe_id: "r1", position: 0, quantity: 2, unit_id: "u1", food_id: "f1", note: "" },
      ],
      recipe_instructions: [
        { recipe_id: "r1", position: 1, text: "Butter it." },
        { recipe_id: "r1", position: 0, text: "Toast it." },
      ],
      tags: [{ id: "t1", name: "Quick" }],
      recipes_to_tags: [{ recipe_id: "r1", tag_id: "t1" }],
    };
    const archive = zipSync({
      "database.json": strToU8(JSON.stringify(database)),
      "data/recipes/r1/images/original.webp": jpeg,
    });
    const result = readImportFile("mealie_backup.zip", archive);
    expect(result.skipped).toEqual([]);
    const [imported] = result.recipes;
    expect(imported?.recipe.title).toBe("Toast");
    expect(imported?.recipe.ingredients).toEqual([
      { amount: "2", unit: "slice", name: "bread", note: "" },
    ]);
    expect(imported?.recipe.instructions.map((step) => step.text)).toEqual([
      "Toast it.",
      "Butter it.",
    ]);
    expect(imported?.recipe.tags).toEqual(["quick"]);
    expect(imported?.image?.extension).toBe("jpg");
  });

  test("imports schema.org JSON-LD files", () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "x" },
        {
          "@type": "Recipe",
          name: "Lemonade",
          url: "https://example.com/lemonade",
          recipeIngredient: ["4 lemons", "1 cup sugar"],
          recipeInstructions: "Squeeze. Stir.",
        },
      ],
    };
    const result = readImportFile("lemonade.json", strToU8(JSON.stringify(jsonLd)));
    expect(result.recipes[0]?.recipe.title).toBe("Lemonade");
    expect(result.recipes[0]?.recipe.sourceUrl).toBe("https://example.com/lemonade");
    expect(result.recipes[0]?.recipe.ingredients).toHaveLength(2);
  });

  test("explains files it cannot use", () => {
    expect(readImportFile("notes.json", strToU8("{nope")).skipped).toEqual([
      "notes.json: not valid JSON",
    ]);
    expect(readImportFile("x.json", strToU8('{"hello":1}')).skipped).toEqual([
      "x.json: no recipe found",
    ]);
  });

  test("refuses gzip data that inflates past the limit", () => {
    const bomb = gzipSync(new Uint8Array(5 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(64 * 1024);
    expect(() => gunzipLimited(bomb, 1024 * 1024)).toThrow();
    expect(gunzipLimited(bomb, 6 * 1024 * 1024).length).toBe(5 * 1024 * 1024);
    const archive = zipSync({ "big.paprikarecipe": gzipSync(new Uint8Array(41 * 1024 * 1024)) });
    expect(readImportFile("big.paprikarecipes", archive).skipped).toEqual([
      "big.paprikarecipe: could not read",
    ]);
  });

  test("recognizes image bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpg");
    expect(sniffImage(strToU8("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffImage(strToU8("<svg></svg>  "))).toBeNull();
  });
});

describe("Claude output normalization", () => {
  const base = {
    found: true,
    title: "  Soup  ",
    description: "",
    prepMinutes: 10,
    cookMinutes: 5000,
    servings: 0,
    tags: ["Soup", ""],
    ingredients: [
      { amount: "1", unit: "cup", name: "water", note: "" },
      { amount: "", unit: "", name: "  ", note: "" },
    ],
    instructions: ["Boil.", " "],
  };

  test("clamps values and drops empty rows", () => {
    const recipe = toRecipeInput(base);
    expect(recipe?.title).toBe("Soup");
    expect(recipe?.prepMinutes).toBe(10);
    expect(recipe?.cookMinutes).toBeNull();
    expect(recipe?.servings).toBeNull();
    expect(recipe?.tags).toEqual(["soup"]);
    expect(recipe?.ingredients).toHaveLength(1);
    expect(recipe?.instructions).toEqual([{ text: "Boil." }]);
  });

  test("returns nothing when no recipe was found", () => {
    expect(toRecipeInput({ ...base, found: false })).toBeNull();
    expect(toRecipeInput({ ...base, ingredients: [], instructions: [] })).toBeNull();
  });
});
