import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isReelUrl } from "../src/shared/reel";
import { extractRecipe } from "./ai";
import { publicRecipeUrl } from "./fetch-recipe";
import { imageExtension, saveUpload } from "./uploads";
import { transcribeFile, whisperEnabled } from "./whisper";

export { isReelUrl };

const ytDlp = () => process.env.MISE_YT_DLP?.trim() || "yt-dlp";

const run = async (cmd: string[]) => {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
};

const runYtDlp = (args: string[]) => run([ytDlp(), ...args]);

type ThumbCandidate = { url: string; area: number };

export const thumbnailFromMeta = (data: {
  thumbnail?: unknown;
  thumbnails?: unknown;
}) => {
  if (
    typeof data.thumbnail === "string" &&
    /^https?:\/\//i.test(data.thumbnail)
  )
    return data.thumbnail;

  if (!Array.isArray(data.thumbnails)) return null;

  const thumbs = data.thumbnails.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const row = item as { url?: unknown; width?: unknown; height?: unknown };
    if (typeof row.url !== "string" || !/^https?:\/\//i.test(row.url))
      return [];

    const w = typeof row.width === "number" ? row.width : 0;
    const h = typeof row.height === "number" ? row.height : 0;

    return [{ url: row.url, area: w * h }];
  });

  const best = thumbs.reduce<ThumbCandidate | null>(
    (acc, row) => (!acc || row.area >= acc.area ? row : acc),
    null
  );

  return best?.url ?? null;
};

const reelMeta = async (url: string) => {
  const { code, stdout, stderr } = await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    "--dump-json",
    "--no-download",
    url,
  ]);
  if (code !== 0) {
    console.error("yt-dlp meta failed", stderr.slice(0, 500));
    return null;
  }
  try {
    const data = JSON.parse(stdout) as {
      title?: unknown;
      description?: unknown;
      fulltitle?: unknown;
      thumbnail?: unknown;
      thumbnails?: unknown;
    };
    const title =
      (typeof data.title === "string" && data.title) ||
      (typeof data.fulltitle === "string" && data.fulltitle) ||
      "";
    const description =
      typeof data.description === "string" ? data.description : "";
    return {
      title: title.trim(),
      description: description.trim(),
      thumbnail: thumbnailFromMeta(data),
    };
  } catch {
    return null;
  }
};

/** download the CDN thumb into /uploads so it survives after TikTok links expire. */
const storeThumbnail = async (raw: string) => {
  const url = await publicRecipeUrl(raw);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "Mise/0.1 (recipe import)" },
      redirect: "follow",
    });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return null;

    return saveUpload(bytes, imageExtension(type));
  } catch (error) {
    console.error(error);
    return null;
  }
};

const measureUnit =
  "cups?|tsp|tbsp|oz|lbs?|g|kg|ml|grams?|cloves?|cans?|strips?|eggs?|butter|flour|sugar";

/** caption lists measured ingredients (TikTok often flattens to one line). */
export const captionLooksLikeRecipe = (text: string) => {
  const body = text.trim();
  if (
    /\bingredients?\b/i.test(body) &&
    /\b(steps?|directions?|method|instructions?)\b/i.test(body)
  )
    return true;

  if (body.length < 80) return false;

  const phrases =
    body.match(
      new RegExp(
        String.raw`\d+(?:\s+\d+/\d+|/\d+)?\s*(?:${measureUnit})\b`,
        "gi"
      )
    ) ?? [];
  if (phrases.length >= 3) return true;

  const lines = body.split(/\n+/).filter((l) => l.trim().length > 0);
  const measured = lines.filter(
    (l) =>
      /\d/.test(l) &&
      new RegExp(String.raw`\b(?:${measureUnit})\b`, "i").test(l)
  );

  return measured.length >= 3;
};

/** caption also has cook steps — only then skip downloading the video. */
export const captionHasSteps = (text: string) => {
  const body = text.trim();
  if (/\b(steps?|directions?|method|instructions?)\b/i.test(body)) return true;

  // numbered steps, or several imperative cook verbs with some length.
  const numbered = (body.match(/(?:^|\n)\s*\d+[.)]\s+\S+/g) ?? []).length;
  if (numbered >= 2) return true;

  const verbs =
    body.match(
      /\b(mix|stir|bake|roast|simmer|saute|sauté|blend|whisk|marinate|assemble|spread|fold|roll|grill|fry|boil|chop|mince|sear)\b/gi
    ) ?? [];
  return verbs.length >= 3 && body.length >= 200;
};

const downloadFailMessage = (stderr: string) => {
  if (/IP address is blocked/i.test(stderr))
    return "TikTok blocked this download. Try again in a bit, or from another network.";

  if (/Private video|login required|members only|not available/i.test(stderr))
    return "That video is private or restricted.";

  if (/ffmpeg is not installed|ffprobe.*not found/i.test(stderr))
    return "ffmpeg is required to import reels. Install it on the server.";

  if (/Unsupported URL|No video formats/i.test(stderr))
    return "Could not read that video. Update yt-dlp and try again.";

  return "Could not download that video. Is the link public?";
};

/**
 * progressive video for Whisper audio + on-screen frame sampling. Caller must
 * delete `dir`.
 */
const downloadVideo = async (url: string) => {
  const dir = await mkdtemp(join(tmpdir(), "mise-reel-"));
  const { code, stderr } = await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    // portrait clips report the long edge as height; cap width for ~720p.
    "-f",
    "best[width<=720][ext=mp4][vcodec!=none]/best[ext=mp4][vcodec!=none]/best",
    "-o",
    join(dir, "video.%(ext)s"),
    "--no-write-thumbnail",
    "--no-embed-thumbnail",
    "--no-embed-metadata",
    "--no-write-info-json",
    url,
  ]);
  if (code !== 0) {
    await rm(dir, { recursive: true, force: true });
    console.error("yt-dlp media failed", stderr.slice(0, 500));
    return { ok: false as const, error: downloadFailMessage(stderr) };
  }

  const files = (await readdir(dir)).filter((name) => !name.startsWith("."));
  const file = files[0];
  if (!file) {
    await rm(dir, { recursive: true, force: true });
    return { ok: false as const, error: "Could not download that video." };
  }

  return { ok: true as const, dir, path: join(dir, file) };
};

const videoDuration = async (path: string) => {
  const { code, stdout } = await run([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    path,
  ]);
  if (code !== 0) return null;
  const seconds = Number.parseFloat(stdout.trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

/** recipe-ish OCR line — drops tesseract noise from busy video frames. */
export const ocrLineLooksUseful = (line: string) => {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (cleaned.length < 6) return false;
  const letters = (cleaned.match(/[a-z]/gi) ?? []).length;
  if (letters < 4 || letters / cleaned.length < 0.45) return false;
  // a lone digit (frame junk like "7. wees") is not enough — need a unit/food word.
  const measured =
    /\d/.test(cleaned) &&
    /\b(cup|cups|tsp|tbsp|oz|lb|g|kg|ml|grams?|cloves?|strips?|mins?|minutes?|onion|garlic|bacon|oil|salt|cream|cheese|butter|flour|sugar|carrot|broccoli|eggs?|paprika|cheddar|heavy|yellow)\b/i.test(
      cleaned
    );
  const step =
    /\b(add|roast|stir|mix|pour|mince|chop|bake|cook|simmer|saute|sauté|blend|whisk|top with|serve)\b/i.test(
      cleaned
    );
  return measured || step;
};

/** enough measured OCR lines to trust overlays over Whisper (music often hallucinates). */
export const onScreenLooksLikeRecipe = (text: string) => {
  const lines = text.split(/\n+/).filter(ocrLineLooksUseful);
  const measured = lines.filter((l) => /\d/.test(l));
  return measured.length >= 3 || lines.length >= 5;
};

const tesseractBin = () => process.env.MISE_TESSERACT?.trim() || "tesseract";

const ocrFrame = async (path: string) => {
  const { code, stdout } = await run([
    tesseractBin(),
    path,
    "stdout",
    "--psm",
    "6",
  ]);
  if (code !== 0) return [];
  return stdout
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(ocrLineLooksUseful);
};

/**
 * evenly spaced stills → OCR burned-in ingredient / step overlays. Needs
 * ffmpeg + tesseract on PATH (Docker image includes both).
 */
export const onScreenTextFromVideo = async (videoPath: string, dir: string) => {
  const duration = (await videoDuration(videoPath)) ?? 30;
  // overlays often flash for ~1–2s; ~2fps catches short ingredient cards
  // (1fps still missed onion/cheddar on a 60s TikTok).
  const count = Math.min(60, Math.max(20, Math.round(duration * 2)));
  const fps = count / duration;
  const frameDir = join(dir, "frames");
  await mkdir(frameDir, { recursive: true });
  const { code, stderr } = await run([
    "ffmpeg",
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=${fps},scale=720:-2`,
    "-q:v",
    "3",
    join(frameDir, "f%03d.jpg"),
  ]);
  if (code !== 0) {
    console.error("ffmpeg frames failed", stderr.slice(0, 400));
    return "";
  }

  const names = (await readdir(frameDir)).filter((n) => /\.jpe?g$/i.test(n));
  names.sort();

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const name of names) {
    for (const line of await ocrFrame(join(frameDir, name))) {
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (key.length < 4 || seen.has(key)) continue;
      // near-duplicate of a longer line we already kept
      if ([...seen].some((s) => s.includes(key) || key.includes(s))) continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return lines.join("\n");
};

const spokenFromVideo = async (videoPath: string) => {
  if (!whisperEnabled()) return { ok: true as const, value: "" };

  const result = await transcribeFile(videoPath);
  // no speech is common (music + on-screen text only) — keep going with frames.
  if (!result.ok && /No speech found/i.test(result.error!))
    return { ok: true as const, value: "" };

  return { ok: true as const, value: result.value! };
};

export const recipeFromReel = async (raw: string) => {
  const url = await publicRecipeUrl(raw);
  if (!url || !isReelUrl(url.toString()))
    return { ok: false as const, error: "Paste a TikTok or Instagram link" };

  const href = url.toString();
  const meta = await reelMeta(href);
  if (!meta)
    return {
      ok: false as const,
      error:
        "Could not read that video. Is yt-dlp installed, and is the link public?",
    };

  const caption = [meta.title, meta.description].filter(Boolean).join("\n\n");
  const captionIngredients = captionLooksLikeRecipe(caption);
  const captionSteps = captionHasSteps(caption);

  // caption has ingredients AND steps — no need to download the video.
  if (captionIngredients && captionSteps) {
    const recipe = await extractRecipe({
      text: `Video caption:\n${caption}`,
      image: null,
      spoken: true,
    });
    if (!recipe.ok) return recipe;
    const image = meta.thumbnail ? await storeThumbnail(meta.thumbnail) : null;
    return {
      ok: true as const,
      value: {
        ...recipe.value,
        sourceUrl: href,
        image: image ?? recipe.value.image,
      },
    };
  }

  // need Whisper and/or OCRable frames (caption may have amounts but not steps).
  if (!whisperEnabled())
    return {
      ok: false as const,
      error:
        "That video has no full recipe in the caption. Set MISE_WHISPER_API_KEY and MISE_WHISPER_MODEL to import it (on-screen text is OCR'd from frames too).",
    };

  const media = await downloadVideo(href);
  if (!media.ok) return media;

  try {
    // OCR first: many reels only list ingredients on screen, and Whisper will
    // invent ingredients from background music when nobody is talking.
    const onScreen = await onScreenTextFromVideo(media.path, media.dir);
    const trustOverlay =
      onScreenLooksLikeRecipe(onScreen) && !captionIngredients;
    // caption has amounts but not steps → always hear the narration for steps.
    // overlays alone are enough only when the caption wasn't already the source.
    let spokenText = "";
    if (captionIngredients || !trustOverlay) {
      const spoken = await spokenFromVideo(media.path);
      if (!spoken.ok) return spoken;
      spokenText = spoken.value;
    }

    if (!spokenText.trim() && !onScreen.trim() && !captionIngredients)
      return {
        ok: false as const,
        error:
          "No speech or on-screen recipe text found in that video. Try a different link.",
      };

    // captions often carry full amounts (esp. TikTok descriptions) even when
    // speech just says "chicken". Strip hashtags; keep the rest as context.
    const captionBody = [meta.title, meta.description]
      .filter(Boolean)
      .join("\n\n")
      .replace(/#\S+/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 4000);

    const text = [
      captionBody
        ? `Video caption (${captionIngredients ? "primary source for ingredients and amounts" : "prefer amounts listed here"}; ignore fluff):\n${captionBody}`
        : "",
      onScreen.trim()
        ? `On-screen text overlays (OCR — ${trustOverlay ? "primary source for ingredients and amounts" : "use alongside speech"}):\n${onScreen.trim()}`
        : "",
      spokenText.trim()
        ? `Spoken / narrated recipe${captionIngredients ? " (primary source for steps)" : ""}:\n${spokenText.trim()}`
        : trustOverlay
          ? ""
          : "No useful speech was found.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const recipe = await extractRecipe({
      text,
      image: null,
      spoken: true,
    });
    if (!recipe.ok) return recipe;

    const image = meta.thumbnail ? await storeThumbnail(meta.thumbnail) : null;

    return {
      ok: true as const,
      value: {
        ...recipe.value,
        sourceUrl: href,
        image: image ?? recipe.value.image,
      },
    };
  } finally {
    await rm(media.dir, { recursive: true, force: true });
  }
};
