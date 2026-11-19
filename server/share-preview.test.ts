import { describe, expect, test } from "bun:test";
import type { SharedRecipe } from "../src/shared/recipe";
import { parseRecipeHtml } from "./recipe-page";
import {
  absoluteImageUrl,
  componentEmbedJson,
  escapeHtml,
  isPreviewBot,
  ogDescription,
  sharePreviewHtml,
} from "./share-preview";

const recipe = (overrides: Partial<SharedRecipe> = {}): SharedRecipe => ({
  title: "Tomato Soup",
  description: "A simple pot of soup for cold nights.",
  image: "/uploads/soup.jpg",
  sourceUrl: null,
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  ownerName: "Ada",
  tags: ["soup"],
  ingredients: [
    { amount: "2", unit: "tbsp", name: "butter", note: "" },
    { amount: "1", unit: "can", name: "tomatoes", note: "" },
    { amount: "2", unit: "cups", name: "stock", note: "" },
  ],
  instructions: [{ text: "Simmer everything until smooth." }],
  ...overrides,
});

describe("share preview bots", () => {
  test("recognizes Discord and other unfurlers", () => {
    expect(
      isPreviewBot(
        "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
      )
    ).toBe(true);
    expect(isPreviewBot("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isPreviewBot("Mise/0.1 (recipe import)")).toBe(true);
    expect(isPreviewBot("Mozilla/5.0 (Macintosh) Chrome/120")).toBe(false);
  });
});

describe("share preview markup", () => {
  test("builds absolute image urls from uploads", () => {
    expect(absoluteImageUrl("/uploads/soup.jpg", "https://mise.test")).toBe(
      "https://mise.test/uploads/soup.jpg"
    );
    expect(
      absoluteImageUrl("https://cdn.test/a.png", "https://mise.test")
    ).toBe("https://cdn.test/a.png");
    expect(absoluteImageUrl("javascript:alert(1)", "https://mise.test")).toBe(
      null
    );
  });

  test("og description prefers timing and servings", () => {
    expect(ogDescription(recipe())).toContain("10 min prep");
    expect(ogDescription(recipe())).toContain("serves 4");
    expect(ogDescription(recipe())).toContain("by Ada");
  });

  test("html includes open graph tags, json-ld, and a simple discord embed", () => {
    const html = sharePreviewHtml(
      recipe(),
      "https://mise.test/s/Ab12Cd34",
      "https://mise.test"
    );
    expect(html).toContain('property="og:title" content="Tomato Soup"');
    expect(html).toContain(
      'property="og:image" content="https://mise.test/uploads/soup.jpg"'
    );
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Recipe"');
    expect(html).toContain('id="discord:component-embed"');
    expect(html).toContain("Tomato Soup");
  });

  test("discord embed is a short card with title, author, and timing", () => {
    const json = componentEmbedJson(recipe(), "https://mise.test/s/Ab12Cd34");
    const payload = JSON.parse(json) as {
      component: { components: { content: string }[] };
    };
    const content = payload.component.components[0]?.content ?? "";
    expect(content).toContain("-# Mise");
    expect(content).toContain("Tomato Soup");
    expect(content).toContain("by Ada");
    expect(content).toContain("A simple pot of soup");
    expect(content).toContain("10 min prep · 25 min cook · serves 4");
    expect(content).not.toContain("Ingredients");
  });

  test("json-ld round-trips through the normal html importer", () => {
    const html = sharePreviewHtml(
      recipe({
        ingredients: [
          { amount: "2", unit: "tbsp", name: "butter", note: "melted" },
          { amount: "1", unit: "can", name: "tomatoes", note: "" },
        ],
      }),
      "https://mise.test/s/Ab12Cd34",
      "https://mise.test"
    );
    const parsed = parseRecipeHtml(html);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.recipe.title).toBe("Tomato Soup");
    expect(parsed.recipe.prepMinutes).toBe(10);
    expect(parsed.recipe.cookMinutes).toBe(25);
    expect(parsed.recipe.servings).toBe(4);
    expect(parsed.recipe.image).toBe("https://mise.test/uploads/soup.jpg");
    expect(parsed.recipe.ingredients[0]).toEqual({
      amount: "2",
      unit: "tbsp",
      name: "butter",
      note: "melted",
    });
    expect(parsed.recipe.instructions).toEqual([
      { text: "Simmer everything until smooth." },
    ]);
  });

  test("escapes html in titles", () => {
    expect(escapeHtml(`Soup <script> & "hi"`)).toBe(
      "Soup &lt;script&gt; &amp; &quot;hi&quot;"
    );
    const html = sharePreviewHtml(
      recipe({ title: `Chips & "Salsa" <3` }),
      "https://mise.test/s/Ab12Cd34",
      "https://mise.test"
    );
    expect(html).toContain("Chips &amp; &quot;Salsa&quot; &lt;3");
    expect(html).not.toContain("<3");
  });
});
