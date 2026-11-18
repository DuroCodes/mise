import { readFile } from "node:fs/promises";

/**
 * speech-to-text for TikTok / Instagram reels. Separate from MISE_AI_* because
 * Anthropic (and most chat models) cannot take audio.
 *
 *   MISE_WHISPER_API_KEY=…
 *   MISE_WHISPER_MODEL=groq:whisper-large-v3-turbo
 *
 * providers: groq, openai, openrouter. Prefix is required.
 */
export const whisperProviders = ["groq", "openai", "openrouter"] as const;
type WhisperProvider = (typeof whisperProviders)[number];

type WhisperSetup = {
  provider: WhisperProvider;
  model: string;
  apiKey: string;
};

const providers = new Set<string>(whisperProviders);

const baseUrl = (provider: WhisperProvider) => {
  if (provider === "groq") return "https://api.groq.com/openai/v1";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return "https://api.openai.com/v1";
};

export const whisperSetup = (): WhisperSetup | null => {
  const raw = process.env.MISE_WHISPER_MODEL?.trim();
  const apiKey = process.env.MISE_WHISPER_API_KEY?.trim() ?? "";
  if (!raw || !apiKey) return null;
  const split = raw.indexOf(":");
  const head = split === -1 ? "" : raw.slice(0, split);
  const model = split === -1 ? "" : raw.slice(split + 1);
  if (!providers.has(head) || !model) return null;
  return { provider: head as WhisperProvider, model, apiKey };
};

export const whisperEnabled = () => whisperSetup() !== null;

export type WhisperStatus = {
  enabled: boolean;
  provider: WhisperProvider | null;
  model: string | null;
  hint: string | null;
};

/** what admins see. Env-only for now; the key never leaves the server. */
export const whisperStatus = (): WhisperStatus => {
  const setup = whisperSetup();
  return {
    enabled: Boolean(setup),
    provider: setup?.provider ?? null,
    model: setup?.model ?? null,
    hint: setup?.apiKey ? `…${setup.apiKey.slice(-4)}` : null,
  };
};

export type WhisperResult =
  { ok: true; value: string } | { ok: false; error: string };

/** OpenAI-compatible POST /audio/transcriptions. */
export const transcribeFile = async (path: string): Promise<WhisperResult> => {
  const setup = whisperSetup();
  if (!setup)
    return {
      ok: false,
      error:
        "Set MISE_WHISPER_API_KEY and MISE_WHISPER_MODEL (e.g. groq:whisper-large-v3-turbo)",
    };

  const bytes = await readFile(path);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), "audio.mp3");
  form.append("model", setup.model);

  try {
    const response = await fetch(
      `${baseUrl(setup.provider)}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${setup.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(90_000),
      }
    );
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "The Whisper API key was rejected" };
    if (response.status === 429)
      return {
        ok: false,
        error: "Whisper is rate-limited. Try again in a minute.",
      };
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      console.error("whisper failed", response.status, detail);
      return { ok: false, error: "Could not transcribe that audio" };
    }
    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return { ok: false, error: "No speech found in that video" };
    return { ok: true, value: text };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Could not reach the Whisper API" };
  }
};
