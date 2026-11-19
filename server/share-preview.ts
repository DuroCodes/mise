import type { SharedRecipe } from "../src/shared/recipe";
import { formatMinutes, ingredientLine } from "../src/lib/format";

/** crawlers that need server-rendered preview markup (no JS). Mise's own
 * importer is included so another instance can read the JSON-LD. */
export const PREVIEW_BOT =
  /Discordbot|Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Mise\//i;

export const isPreviewBot = (userAgent: string | undefined) =>
  PREVIEW_BOT.test(userAgent ?? "");

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

const timingBits = (recipe: SharedRecipe) =>
  [
    recipe.prepMinutes !== null
      ? `${formatMinutes(recipe.prepMinutes)} prep`
      : null,
    recipe.cookMinutes !== null
      ? `${formatMinutes(recipe.cookMinutes)} cook`
      : null,
    recipe.servings !== null ? `serves ${recipe.servings}` : null,
  ].filter((bit): bit is string => Boolean(bit));

export const ogDescription = (recipe: SharedRecipe) => {
  const bits = [
    ...timingBits(recipe),
    recipe.ownerName ? `by ${recipe.ownerName}` : null,
  ].filter((bit): bit is string => Boolean(bit));
  const body = oneLine(recipe.description);
  const joined = [...bits, body].filter(Boolean).join(" · ");
  return shorten(joined || "A shared recipe on Mise.", 200);
};

/** Discord markdown cannot keep link/emphasis markup in labels. */
const mdLabel = (value: string) =>
  oneLine(value)
    .replaceAll(/[[\]*()\\]/g, "")
    .slice(0, 120) || "Recipe";

const ACCENT = 0xb8762b;

export const componentEmbedJson = (recipe: SharedRecipe, pageUrl: string) => {
  const title = mdLabel(recipe.title);
  const lines = ["-# Mise", `## [${title}](${pageUrl})`];
  if (recipe.ownerName) lines.push(`by ${mdLabel(recipe.ownerName)}`);
  const description = oneLine(recipe.description)
    ? shorten(recipe.description, 280)
    : "";
  if (description) lines.push("", description);
  const timing = timingBits(recipe);
  if (timing.length) lines.push("", `-# ${timing.join(" · ")}`);

  return JSON.stringify({
    component: {
      type: 17,
      accent_color: ACCENT,
      components: [{ type: 10, content: lines.join("\n") }],
    },
  }).replaceAll("<", "\\u003c");
};

const isoDuration = (minutes: number | null) => {
  if (minutes === null || minutes < 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `PT${hours}H${rest}M`;
  if (hours) return `PT${hours}H`;
  return `PT${rest}M`;
};

const ldIngredient = (item: SharedRecipe["ingredients"][number]) => {
  const line = ingredientLine(item);
  const note = item.note.trim();
  return note ? `${line} (${note})` : line;
};

/** schema.org Recipe for importers (and search) that read JSON-LD. */
export const recipeJsonLd = (
  recipe: SharedRecipe,
  pageUrl: string,
  origin: string
) => {
  const image = absoluteImageUrl(recipe.image, origin);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: oneLine(recipe.title) || "Recipe",
    url: pageUrl,
  };
  if (oneLine(recipe.description))
    data.description = oneLine(recipe.description);
  if (image) data.image = image;
  if (recipe.sourceUrl) data.isBasedOn = recipe.sourceUrl;
  const prep = isoDuration(recipe.prepMinutes);
  const cook = isoDuration(recipe.cookMinutes);
  if (prep) data.prepTime = prep;
  if (cook) data.cookTime = cook;
  if (recipe.servings !== null) data.recipeYield = String(recipe.servings);
  if (recipe.tags.length) data.keywords = recipe.tags.join(", ");
  if (recipe.ownerName)
    data.author = { "@type": "Person", name: recipe.ownerName };
  data.recipeIngredient = recipe.ingredients.map(ldIngredient);
  data.recipeInstructions = recipe.instructions.map((step) => ({
    "@type": "HowToStep",
    text: step.text,
  }));
  return JSON.stringify(data).replaceAll("<", "\\u003c");
};

export const sharePreviewHtml = (
  recipe: SharedRecipe,
  pageUrl: string,
  origin: string
) => {
  const title = oneLine(recipe.title) || "Recipe";
  const description = ogDescription(recipe);
  const image = absoluteImageUrl(recipe.image, origin);
  const jsonLd = recipeJsonLd(recipe, pageUrl, origin);
  const embed = componentEmbedJson(recipe, pageUrl);
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
  <script type="application/ld+json">${jsonLd}</script>
  <script id="discord:component-embed" type="application/json">${embed}</script>
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`;
};
