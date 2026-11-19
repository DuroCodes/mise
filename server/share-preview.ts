import type { SharedRecipe } from "../src/shared/recipe";
import { formatMinutes, ingredientLine } from "../src/lib/format";

/** crawlers that need server-rendered preview markup (Discord does not run JS). */
export const PREVIEW_BOT =
  /Discordbot|Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp/i;

const MAX_EMBED_BYTES = 3000;
const ACCENT = 0xb8762b;

export const isPreviewBot = (userAgent: string | undefined) =>
  PREVIEW_BOT.test(userAgent ?? "");

const bytes = (value: string) => new TextEncoder().encode(value).length;

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

const shorten = (value: string, limit: number) => {
  const text = oneLine(value);
  if (text.length <= limit) return text;
  if (limit < 2) return "";
  const cut = text
    .slice(0, limit - 1)
    .replace(/\s+\S*$/, "")
    .trimEnd();
  const kept = cut || text.slice(0, limit - 1).trimEnd();
  return kept ? `${kept}…` : "";
};

/** discord markdown labels cannot keep link/emphasis markup. */
const mdLabel = (value: string) =>
  oneLine(value)
    .replaceAll(/[[\]*()\\]/g, "")
    .slice(0, 120) || "Recipe";

export const absoluteImageUrl = (
  image: string | null,
  origin: string
): string | null => {
  if (!image) return null;
  try {
    const url = new URL(image, origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const href = url.href;
    if (href.length > 2048) return null;
    return href;
  } catch {
    return null;
  }
};

const metaBits = (recipe: SharedRecipe) =>
  [
    recipe.prepMinutes !== null
      ? `${formatMinutes(recipe.prepMinutes)} prep`
      : null,
    recipe.cookMinutes !== null
      ? `${formatMinutes(recipe.cookMinutes)} cook`
      : null,
    recipe.servings !== null ? `serves ${recipe.servings}` : null,
    recipe.ownerName ? `by ${recipe.ownerName}` : null,
  ].filter((bit): bit is string => Boolean(bit));

export const ogDescription = (recipe: SharedRecipe) => {
  const bits = metaBits(recipe);
  const body = oneLine(recipe.description);
  const joined = [...bits, body].filter(Boolean).join(" · ");
  return shorten(joined || "A shared recipe on Mise.", 200);
};

const ingredientLines = (recipe: SharedRecipe, limit: number) =>
  recipe.ingredients
    .slice(0, limit)
    .map((item) => `- ${ingredientLine(item)}`)
    .filter((line) => line.length > 2);

const headerText = (
  recipe: SharedRecipe,
  pageUrl: string,
  description: string,
  ingredientLimit: number
) => {
  const lines = [`## [${mdLabel(recipe.title)}](${pageUrl})`];
  const bits = metaBits(recipe);

  if (bits.length) lines.push(`-# ${bits.join(" · ")}`);
  if (description) lines.push(description);

  const ingredients = ingredientLines(recipe, ingredientLimit);

  if (ingredients.length) {
    lines.push("### Ingredients", ...ingredients);
    if (recipe.ingredients.length > ingredientLimit) lines.push("- …");
  }

  return lines.join("\n");
};

const embedDocument = (
  recipe: SharedRecipe,
  pageUrl: string,
  description: string,
  image: string | null,
  ingredientLimit: number
) => ({
  component: {
    type: 17,
    accent_color: ACCENT,
    components: [
      {
        type: 10,
        content: headerText(recipe, pageUrl, description, ingredientLimit),
      },
      ...(image
        ? [
            {
              type: 12,
              items: [{ media: { url: image } }],
            },
          ]
        : []),
      { type: 14, spacing: 1 },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Open recipe",
            url: pageUrl,
          },
        ],
      },
    ],
  },
});

const serializeEmbed = (
  recipe: SharedRecipe,
  pageUrl: string,
  description: string,
  image: string | null,
  ingredientLimit: number
) =>
  JSON.stringify(
    embedDocument(recipe, pageUrl, description, image, ingredientLimit)
  ).replaceAll("<", "\\u003c");

/** shrink description / ingredients / image until the JSON fits discord's 3kb cap. */
export const componentEmbedJson = (
  recipe: SharedRecipe,
  pageUrl: string,
  image: string | null
) => {
  let description = oneLine(recipe.description)
    ? shorten(recipe.description, 280)
    : "";
  let media = image;
  let ingredientLimit = Math.min(8, recipe.ingredients.length);

  const size = () =>
    bytes(serializeEmbed(recipe, pageUrl, description, media, ingredientLimit));

  while (size() > MAX_EMBED_BYTES && ingredientLimit > 0) ingredientLimit -= 1;

  while (size() > MAX_EMBED_BYTES && description) {
    const next = shorten(description, description.length - 40);
    description = next.length < description.length ? next : "";
  }

  if (size() > MAX_EMBED_BYTES) media = null;

  const json = serializeEmbed(
    recipe,
    pageUrl,
    description,
    media,
    ingredientLimit
  );
  return bytes(json) <= MAX_EMBED_BYTES ? json : "";
};

export const sharePreviewHtml = (
  recipe: SharedRecipe,
  pageUrl: string,
  origin: string
) => {
  const title = oneLine(recipe.title) || "Recipe";
  const description = ogDescription(recipe);
  const image = absoluteImageUrl(recipe.image, origin);
  const payload = componentEmbedJson(recipe, pageUrl, image);
  const card = image ? "summary_large_image" : "summary";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} · Mise</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Mise">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
  <meta name="twitter:card" content="${card}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  ${
    payload
      ? `<script id="discord:component-embed" type="application/json">${payload}</script>`
      : ""
  }
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
};
