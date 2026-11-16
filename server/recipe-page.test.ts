import { describe, expect, test } from "bun:test";
import { parseIngredientLine, parseRecipeHtml } from "./recipe-page";

const page = (json: unknown) =>
  `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;

describe("parseRecipeHtml", () => {
  test("reads a schema.org recipe", () => {
    const result = parseRecipeHtml(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Tomato soup",
        description: "A <em>simple</em> pot of soup.",
        prepTime: "PT10M",
        cookTime: "PT30M",
        recipeYield: "4 servings",
        keywords: "soup, tomato",
        recipeIngredient: [
          "2 tbsp olive oil",
          "1 (28 ounce) can crushed tomatoes",
          "salt, to taste",
        ],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Warm the oil." },
          { "@type": "HowToStep", text: "Simmer the tomatoes." },
        ],
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toBe("Tomato soup");
    expect(result.recipe.description).toBe("A simple pot of soup.");
    expect(result.recipe.prepMinutes).toBe(10);
    expect(result.recipe.cookMinutes).toBe(30);
    expect(result.recipe.servings).toBe(4);
    expect(result.recipe.ingredients[0]).toEqual({
      amount: "2",
      unit: "tbsp",
      name: "olive oil",
      note: "",
    });
    expect(result.recipe.instructions).toHaveLength(2);
  });

  test("keeps the page title's capital letters", () => {
    const html = `<html><head><meta property="og:title" content="Easy Slow Cooker BBQ Pulled Pork" /></head><body>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "Easy slow cooker BBQ pulled pork",
        recipeIngredient: ["1 pork shoulder"],
        recipeInstructions: [{ "@type": "HowToStep", text: "Cook it." }],
      })}</script></body></html>`;
    const result = parseRecipeHtml(html);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toBe("Easy Slow Cooker BBQ Pulled Pork");
  });

  test("rejects a page without a recipe", () => {
    expect(parseRecipeHtml("<html><title>Home</title></html>").ok).toBe(false);
  });

  test("splits a note from an ingredient", () => {
    expect(parseIngredientLine("3 cloves garlic, minced")).toEqual({
      amount: "3",
      unit: "cloves",
      name: "garlic",
      note: "minced",
    });
    expect(
      parseIngredientLine(
        "3.5-4.5kg/ 5-7lb pork butt / pork shoulder (, bone in, fat cap on (Note 1))"
      )
    ).toEqual({
      amount: "3.5-4.5",
      unit: "kg",
      name: "pork butt / pork shoulder",
      note: "5-7 lb, bone in, fat cap on (Note 1)",
    });
    expect(
      parseIngredientLine("1 cup beer (, apple cider or apple juice (Note 2))")
    ).toEqual({
      amount: "1",
      unit: "cup",
      name: "beer",
      note: "apple cider or apple juice (Note 2)",
    });
    expect(parseIngredientLine("1 cup apple cider vinegar ((Note 3))")).toEqual(
      {
        amount: "1",
        unit: "cup",
        name: "apple cider vinegar",
        note: "Note 3",
      }
    );
    expect(
      parseIngredientLine("1 (28 ounce) can crushed tomatoes, drained")
    ).toEqual({
      amount: "1",
      unit: "can",
      name: "crushed tomatoes",
      note: "28 ounce, drained",
    });
  });
});
