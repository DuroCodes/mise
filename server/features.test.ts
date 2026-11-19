import { describe, expect, test } from "bun:test";
import { gzipSync, strToU8, zipSync } from "fflate";
import { formatAmount, parseAmount, scaleIngredient } from "../src/lib/units";
import { aisleFor } from "../src/shared/aisles";
import {
  estimateNutrition,
  gramsFor,
  matchFood,
} from "../src/shared/nutrition";
import { combineQuantities, itemKey } from "../src/shared/shopping";
import { findTimers, formatClock } from "../src/shared/timers";
import { convertTemperature, findTemperatures } from "../src/shared/timeline";
import {
  covers,
  isStaple,
  matchListItem,
  rankRecipes,
} from "../src/shared/pantry";
import { safeNext, sharedLink } from "../src/lib/view";
import {
  aiStatus,
  linksFromSearchHtml,
  parseFound,
  plannerRecipes,
  toMealPlan,
  toPhotoItems,
  scrubModelText,
  splitMeasure,
  toRecipeInput,
} from "./ai";
import { captionLooksLikeRecipe, isReelUrl, thumbnailFromMeta } from "./reel";
import { whisperSetup } from "./whisper";
import { isReelUrl as isReelUrlShared } from "../src/shared/reel";
import { linkToken, linkTokenShape } from "./link-token";
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
    expect(
      scaleIngredient({ amount: "200", unit: "g" }, 2, "original")
    ).toEqual({
      amount: "400",
      unit: "g",
    });
    const imperial = scaleIngredient(
      { amount: "454", unit: "g" },
      1,
      "imperial"
    );
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
      combineQuantities(
        { amount: "200", unit: "g" },
        { amount: "100", unit: "g" }
      )
    ).toEqual({ amount: "300", unit: "g" });
    expect(
      combineQuantities(
        { amount: "1", unit: "can" },
        { amount: "2", unit: "cans" }
      )
    ).toEqual({ amount: "3", unit: "can" });
    expect(
      combineQuantities({ amount: "2", unit: "" }, { amount: "4", unit: "" })
    ).toEqual({ amount: "6", unit: "" });
  });

  test("converts compatible units", () => {
    expect(
      combineQuantities(
        { amount: "1", unit: "kg" },
        { amount: "500", unit: "g" }
      )
    ).toEqual({ amount: "1 1/2", unit: "kg" });
    expect(
      combineQuantities(
        { amount: "1", unit: "cup" },
        { amount: "1", unit: "cup" }
      )
    ).toEqual({ amount: "2", unit: "cups" });
    expect(
      combineQuantities(
        { amount: "1/2", unit: "cup" },
        { amount: "4", unit: "tbsp" }
      )
    ).toEqual({ amount: "3/4", unit: "cups" });
  });

  test("refuses to add things that do not add up", () => {
    expect(
      combineQuantities(
        { amount: "2", unit: "cloves" },
        { amount: "1", unit: "head" }
      )
    ).toBeNull();
    expect(
      combineQuantities(
        { amount: "200", unit: "g" },
        { amount: "1", unit: "cup" }
      )
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
    expect(matchListItem("Tillamook Medium Cheddar Cheese", list)?.name).toBe(
      "cheddar cheese"
    );
    expect(matchListItem("Heavy Whipping Cream", list)?.name).toBe(
      "heavy cream"
    );
    expect(matchListItem("Barilla Spaghetti n.5", list)).toBe(list[3]);
    expect(matchListItem("Swanson Chicken Broth", list)).toBeNull();
    expect(matchListItem("Nutella", list)).toBeNull();
  });
});

describe("share links", () => {
  test("codes are short alphanumeric", () => {
    const token = linkToken();
    expect(token).toHaveLength(8);
    expect(token).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(linkTokenShape.test(token)).toBe(true);
    expect(linkTokenShape.test("short")).toBe(false);
    expect(linkTokenShape.test("rdHor_WL")).toBe(false);
  });
});

describe("share target and sign-in redirects", () => {
  test("finds the link in whatever an app shared", () => {
    expect(
      sharedLink(new URLSearchParams({ url: "https://example.com/soup" }))
    ).toBe("https://example.com/soup");
    expect(
      sharedLink(
        new URLSearchParams({
          text: "Try this! https://cooking.test/r/123?x=1). So good",
        })
      )
    ).toBe("https://cooking.test/r/123?x=1");
    expect(
      sharedLink(new URLSearchParams({ title: "Soup", text: "no link here" }))
    ).toBeNull();
    expect(
      sharedLink(new URLSearchParams({ text: "javascript:alert(1)" }))
    ).toBeNull();
  });

  test("only returns to pages on this site", () => {
    expect(safeNext("/recipes/new?import=x")).toBe("/recipes/new?import=x");
    expect(safeNext("//evil.test/")).toBe("/");
    expect(safeNext("https://evil.test/")).toBe("/");
    expect(safeNext("/login?next=/x")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("offline outbox", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  const originalFetch = globalThis.fetch;

  test("queues changes offline, folds them together, and shows them", async () => {
    Object.assign(globalThis, { localStorage: fakeStorage });
    globalThis.fetch = (() =>
      Promise.reject(new TypeError("offline"))) as unknown as typeof fetch;
    const outbox = await import("../src/lib/outbox");
    outbox.outboxFor("u1");
    const server = [
      {
        id: "a",
        name: "milk",
        amount: "1",
        unit: "",
        note: "",
        sources: [],
        checked: false,
      },
      {
        id: "b",
        name: "eggs",
        amount: "12",
        unit: "",
        note: "",
        sources: [],
        checked: false,
      },
    ];
    expect(
      (await outbox.send({ kind: "check", id: "a", checked: true })).queued
    ).toBe(true);
    expect(
      (await outbox.send({ kind: "check", id: "a", checked: false })).queued
    ).toBe(true);
    expect(outbox.pendingCount()).toBe(1);
    await outbox.send({ kind: "remove", id: "b" });
    await outbox.send({
      kind: "add",
      tempId: "local-1",
      name: "lemons",
      amount: "2",
      checked: false,
    });
    await outbox.send({ kind: "check", id: "local-1", checked: true });
    expect(outbox.pendingCount()).toBe(3);
    const shown = outbox.withOutbox(server);
    expect(shown.map((item) => [item.id, item.checked])).toEqual([
      ["a", false],
      ["local-1", true],
    ]);
    await outbox.send({ kind: "remove", id: "local-1" });
    expect(outbox.pendingCount()).toBe(2);

    // back online: everything is sent in order and the queue empties.
    const calls: string[] = [];
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return Promise.resolve(
        new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;
    expect(await outbox.flush()).toBe(true);
    expect(calls).toEqual(["PATCH /api/shopping/a", "DELETE /api/shopping/b"]);
    expect(outbox.pendingCount()).toBe(0);
    outbox.clearOutbox();
    globalThis.fetch = originalFetch;
  });
});

describe("photo to pantry", () => {
  test("cleans up what Claude read", () => {
    expect(
      toPhotoItems({
        items: [
          { name: " Yellow Onion ", amount: "3", unit: "" },
          { name: "yellow onion", amount: "1", unit: "" },
          { name: "", amount: "1", unit: "" },
          { name: "Whole Milk", amount: "1", unit: "gallon" },
        ],
      })
    ).toEqual([
      { name: "yellow onion", amount: "3", unit: "" },
      { name: "whole milk", amount: "1", unit: "gallon" },
    ]);
  });
});

describe("recipe search results", () => {
  const searched = new Set([
    "https://example.com/soup",
    "https://www.recipes.test/toast",
  ]);

  test("keeps only links that came from the search", () => {
    const text =
      'Here you go:\n```json\n[{"title":"Soup","url":"https://example.com/soup/#top","why":"Uses potatoes","uses":["potatoes"]},{"title":"Made up","url":"https://invented.test/x","why":"","uses":[]},{"title":"Soup again","url":"https://example.com/soup","why":"","uses":[]},{"title":"Toast","url":"https://www.recipes.test/toast","uses":["bread"]}]\n```';
    const found = parseFound(text, searched);
    expect(found.map((item) => item.url)).toEqual([
      "https://example.com/soup",
      "https://www.recipes.test/toast",
    ]);
    expect(found[1]?.site).toBe("recipes.test");
    expect(found[1]?.why).toBe("");
  });

  test("handles a bare array, bad JSON, and unsafe links", () => {
    expect(
      parseFound('[{"title":"T","url":"https://example.com/soup"}]', searched)
    ).toHaveLength(1);
    expect(parseFound("no json here", searched)).toEqual([]);
    const html =
      '<a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fsoup&amp;rut=1">Tomato soup</a>' +
      '<a href="https://duckduckgo.com/">home</a>';
    expect(linksFromSearchHtml(html)).toEqual([
      { title: "Tomato soup", url: "https://example.com/soup" },
    ]);
    expect(
      parseFound(
        '[{"title":"x","url":"javascript:alert(1)"}]',
        new Set(["javascript:alert(1)"])
      )
    ).toEqual([]);
  });
});

describe("oven temperatures", () => {
  test("finds and converts oven temperatures", () => {
    const found = findTemperatures(
      "Bake at 400°F for 20 minutes, or 200 °C in a fan oven. Use 425F for crisp. Add 2 C flour."
    );
    expect(found.map((temp) => [temp.value, temp.scale])).toEqual([
      [400, "F"],
      [200, "C"],
      [425, "F"],
    ]);
    expect(convertTemperature(400, "F")).toEqual({ value: 205, scale: "C" });
    expect(convertTemperature(350, "F")).toEqual({ value: 175, scale: "C" });
    expect(convertTemperature(180, "C")).toEqual({ value: 355, scale: "F" });
    expect(findTemperatures("Heat to 180 degrees Celsius")[0]?.value).toBe(180);
    expect(findTemperatures("Chill 30 C")).toEqual([]);
    expect(
      findTemperatures("Bake at 300℉ then finish at 180℃").map((temp) => [
        temp.value,
        temp.scale,
      ])
    ).toEqual([
      [300, "F"],
      [180, "C"],
    ]);
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
    expect(
      gramsFor({ amount: "1", unit: "can (28 oz)" }, tomatoes)
    ).toBeCloseTo(793.8, 0);
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
    expect(estimate.counted).toEqual([
      "spaghetti",
      "Pecorino Romano",
      "black pepper",
    ]);
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
        {
          quantity: 2,
          unit: { name: "tablespoon" },
          food: { name: "olive oil" },
          note: "",
        },
        { quantity: 0.5, unit: null, food: { name: "onion" }, note: "diced" },
        { quantity: 0, food: null, note: "salt to taste", originalText: "" },
      ],
      recipeInstructions: [
        { text: "Warm the oil." },
        { text: "Simmer 20 minutes." },
      ],
    };
    const result = readImportFile(
      "tomato-soup.json",
      strToU8(JSON.stringify(mealie))
    );
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
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
    ]);
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
        {
          recipe_id: "r1",
          position: 0,
          quantity: 2,
          unit_id: "u1",
          food_id: "f1",
          note: "",
        },
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
    const result = readImportFile(
      "lemonade.json",
      strToU8(JSON.stringify(jsonLd))
    );
    expect(result.recipes[0]?.recipe.title).toBe("Lemonade");
    expect(result.recipes[0]?.recipe.sourceUrl).toBe(
      "https://example.com/lemonade"
    );
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
    const archive = zipSync({
      "big.paprikarecipe": gzipSync(new Uint8Array(41 * 1024 * 1024)),
    });
    expect(readImportFile("big.paprikarecipes", archive).skipped).toEqual([
      "big.paprikarecipe: could not read",
    ]);
  });

  test("recognizes image bytes", () => {
    expect(
      sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    ).toBe("jpg");
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
    expect(
      toRecipeInput({ ...base, ingredients: [], instructions: [] })
    ).toBeNull();
  });

  test("strips model markup leaked into ingredient fields", () => {
    expect(scrubModelText("%Y44I1 teaspoon/I %E")).toBe("1 teaspoon");
    expect(scrubModelText("%I2/I %E whole eggs")).toBe("2 whole eggs");
    const recipe = toRecipeInput({
      ...base,
      ingredients: [
        {
          amount: "%Y44I1",
          unit: "teaspoon/I %E",
          name: "%I2/I %E whole eggs",
          note: "",
        },
      ],
    });
    expect(recipe?.ingredients[0]).toEqual({
      amount: "1",
      unit: "teaspoon",
      name: "2 whole eggs",
      note: "",
    });
  });

  test("splits combined amount+unit when the model merges them", () => {
    expect(splitMeasure("", "5 tbsp")).toEqual({
      amount: "5",
      unit: "tbsp",
    });
    expect(splitMeasure("", "3/4 cup")).toEqual({
      amount: "3/4",
      unit: "cup",
    });
    expect(splitMeasure("8 g", "")).toEqual({ amount: "8", unit: "g" });
    const recipe = toRecipeInput({
      ...base,
      ingredients: [
        {
          amount: "",
          unit: "16 oz",
          name: "Cream Cheese",
          note: "Room Temperature",
        },
        { amount: "2", unit: "", name: "eggs", note: "" },
      ],
    });
    expect(recipe?.ingredients[0]).toMatchObject({
      amount: "16",
      unit: "oz",
      name: "cream cheese",
      note: "room temperature",
    });
    expect(recipe?.ingredients[1]).toMatchObject({
      amount: "2",
      unit: "",
      name: "eggs",
    });
  });
});

describe("Claude meal planner", () => {
  const keys = new Map([
    ["r1", "soup"],
    ["r2", "pasta"],
  ]);
  const wanted = new Map([
    ["2026-11-17", new Set(["dinner" as const])],
    ["2026-11-18", new Set(["lunch" as const, "dinner" as const])],
  ]);

  test("keeps meals for requested slots and known recipes only", () => {
    const plan = toMealPlan(
      {
        summary: "  A light week. ",
        meals: [
          { day: "2026-11-17", slot: "Dinner", recipe: "R1", why: "warm" },
          { day: "2026-11-17", slot: "dinner", recipe: "r2", why: "double" },
          { day: "2026-11-17", slot: "lunch", recipe: "r2", why: "not asked" },
          { day: "2026-11-18", slot: "lunch", recipe: "r9", why: "made up" },
          { day: "2026-11-19", slot: "dinner", recipe: "r1", why: "wrong day" },
          { day: "2026-11-18", slot: "dinner", recipe: "r2", why: "quick" },
        ],
      },
      keys,
      wanted
    );
    expect(plan.summary).toBe("A light week.");
    expect(plan.meals).toEqual([
      { day: "2026-11-17", slot: "dinner", recipeId: "soup", why: "warm" },
      { day: "2026-11-18", slot: "dinner", recipeId: "pasta", why: "quick" },
    ]);
  });

  test("sends favorites and regulars first", () => {
    const recipe = (id: string, favorite: boolean, cookCount: number) => ({
      id,
      title: id,
      tags: [],
      prepMinutes: null,
      cookMinutes: null,
      servings: null,
      favorite,
      lastCooked: null,
      cookCount,
      rating: { average: null, count: 0, mine: null },
      ingredients: [],
    });
    const order = plannerRecipes([
      recipe("new", false, 0),
      recipe("regular", false, 5),
      recipe("loved", true, 0),
    ]).map((item) => item.id);
    expect(order).toEqual(["loved", "regular", "new"]);
  });
});

describe("local models", () => {
  test("a local model turns AI on without a key", () => {
    const names = ["MISE_AI_MODEL", "MISE_AI_API_KEY", "MISE_AI_BASE_URL"];
    const before = names.map((name) => process.env[name]);
    try {
      for (const name of names) delete process.env[name];
      process.env.MISE_AI_MODEL = "local:hermes3";
      expect(aiStatus()).toMatchObject({
        enabled: true,
        source: "environment",
        provider: "local",
        model: "hermes3",
        baseURL: "http://localhost:11434/v1",
        hint: null,
      });
      process.env.MISE_AI_MODEL = "openai:gpt-5";
      expect(aiStatus().source).not.toBe("environment");
      process.env.MISE_AI_API_KEY = "test-key";
      process.env.MISE_AI_MODEL = "claude-opus-5-5";
      expect(aiStatus().source).not.toBe("environment");
    } finally {
      names.forEach((name, index) => {
        const value = before[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });
});

describe("social reels", () => {
  test("recognizes TikTok and Instagram hosts", () => {
    expect(
      isReelUrl(
        "https://www.tiktok.com/@sarahsweets017/video/7636918518134443277"
      )
    ).toBe(true);
    expect(isReelUrl("https://vm.tiktok.com/ZMabcdef/")).toBe(true);
    expect(isReelUrl("https://www.instagram.com/reel/AbCdEfGhIjK/")).toBe(true);
    expect(isReelUrl("https://www.allrecipes.com/recipe/123")).toBe(false);
    expect(isReelUrlShared("https://instagram.com/p/xyz/")).toBe(true);
  });

  test("detects captions that already list a recipe", () => {
    expect(captionLooksLikeRecipe("SO creamy 🍓 #dessert")).toBe(false);
    expect(
      captionLooksLikeRecipe(`Ingredients:
1 cup sugar
2 cups flour
3 tbsp butter
Steps:
1. Mix
2. Bake`)
    ).toBe(true);
  });

  test("picks the largest yt-dlp thumbnail", () => {
    expect(
      thumbnailFromMeta({
        thumbnail: "https://cdn.example/cover.jpg",
        thumbnails: [
          { url: "https://cdn.example/small.jpg", width: 100, height: 100 },
          { url: "https://cdn.example/big.jpg", width: 1080, height: 1920 },
        ],
      })
    ).toBe("https://cdn.example/cover.jpg");
    expect(
      thumbnailFromMeta({
        thumbnails: [
          { url: "https://cdn.example/small.jpg", width: 100, height: 100 },
          { url: "https://cdn.example/big.jpg", width: 1080, height: 1920 },
        ],
      })
    ).toBe("https://cdn.example/big.jpg");
  });

  test("whisper env needs provider:model and a key", () => {
    const names = ["MISE_WHISPER_MODEL", "MISE_WHISPER_API_KEY"];
    const before = names.map((name) => process.env[name]);
    try {
      for (const name of names) delete process.env[name];
      expect(whisperSetup()).toBeNull();
      process.env.MISE_WHISPER_MODEL = "groq:whisper-large-v3-turbo";
      expect(whisperSetup()).toBeNull();
      process.env.MISE_WHISPER_API_KEY = "gsk_test";
      expect(whisperSetup()).toEqual({
        provider: "groq",
        model: "whisper-large-v3-turbo",
        apiKey: "gsk_test",
      });
      process.env.MISE_WHISPER_MODEL = "whisper-1";
      expect(whisperSetup()).toBeNull();
    } finally {
      names.forEach((name, index) => {
        const value = before[index];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });
});
