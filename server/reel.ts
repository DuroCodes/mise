import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isReelUrl } from "../src/shared/reel";
import { extractRecipe } from "./ai";
import { publicRecipeUrl } from "./fetch-recipe";
import { imageExtension, saveUpload } from "./uploads";
import { transcribeFile, whisperEnabled } from "./whisper";

export { isReelUrl };

const ytDlp = () => process.env.MISE_YT_DLP?.trim() || "yt-dlp";

const runYtDlp = async (args: string[]) => {
  const proc = Bun.spawn([ytDlp(), ...args], {
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

type ReelMeta = {
  title: string;
  description: string;
  thumbnail: string | null;
};

type ThumbCandidate = { url: string; area: number };

/** picks the best thumbnail URL from yt-dlp JSON. Exported for tests. */
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

  const thumbs = data.thumbnails.flatMap((item): ThumbCandidate[] => {
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

const reelMeta = async (url: string): Promise<ReelMeta | null> => {
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

/** caption looks like it already lists a recipe — skip Whisper. */
export const captionLooksLikeRecipe = (text: string) => {
  const body = text.trim();
  if (
    /\bingredients?\b/i.test(body) &&
    /\b(steps?|directions?|method|instructions?)\b/i.test(body)
  )
    return true;

  if (body.length < 80) return false;

  const lines = body.split(/\n+/).filter((l) => l.trim().length > 0);
  const measured = lines.filter(
    (l) =>
      /\d/.test(l) &&
      /\b(cup|cups|tsp|tbsp|oz|lb|g|kg|ml|gram|eggs?|butter|flour|sugar)\b/i.test(
        l
      )
  );

  return measured.length >= 3;
};

/**
 * downloads media for Whisper into a temp dir. Caller must delete `dir`.
 * TikTok's standalone `audio` format is often music-only (no voiceover), so
 * prefer a progressive mp4 that muxes speech. Whisper accepts video files.
 * shortcut: needs a host-ready format; if yt-dlp demands remux, install ffmpeg
 */
const downloadForTranscript = async (url: string) => {
  const dir = await mkdtemp(join(tmpdir(), "mise-reel-"));
  const { code, stderr } = await runYtDlp([
    "--no-playlist",
    "--no-warnings",
    "-f",
    // progressive video+audio first; bare `ba`/`audio` on TikTok is usually music.
    "best[height<=720][ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/best/ba",
    "-o",
    join(dir, "media.%(ext)s"),
    "--no-write-thumbnail",
    "--no-embed-thumbnail",
    "--no-embed-metadata",
    "--no-write-info-json",
    url,
  ]);
  if (code !== 0) {
    await rm(dir, { recursive: true, force: true });
    console.error("yt-dlp media failed", stderr.slice(0, 500));
    return null;
  }

  const files = (await readdir(dir)).filter((name) => !name.startsWith("."));
  const file = files[0];
  if (!file) {
    await rm(dir, { recursive: true, force: true });
    return null;
  }

  return { dir, path: join(dir, file) };
};

const spokenFromReel = async (href: string, caption: string) => {
  if (captionLooksLikeRecipe(caption))
    return { ok: true as const, value: caption };

  if (!whisperEnabled())
    return {
      ok: false as const,
      error:
        "That video has no recipe in the caption. Set MISE_WHISPER_API_KEY and MISE_WHISPER_MODEL to transcribe it.",
    };

  const media = await downloadForTranscript(href);
  if (!media)
    return {
      ok: false as const,
      error:
        "Could not download the video audio. Update yt-dlp, or install ffmpeg if remux is required.",
    };

  try {
    return await transcribeFile(media.path);
  } finally {
    await rm(media.dir, { recursive: true, force: true });
  }
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
  const spoken = await spokenFromReel(href, caption);
  if (!spoken.ok) return spoken;

  const text = [
    meta.title || meta.description
      ? `Video caption (for context only — write your own title and description):\n${[meta.title, meta.description !== meta.title ? meta.description : ""].filter(Boolean).join("\n")}`
      : "",
    `Spoken / on-video recipe:\n${spoken.value}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const recipe = await extractRecipe({ text, image: null, spoken: true });
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
};
