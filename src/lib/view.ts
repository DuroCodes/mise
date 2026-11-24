import type { Measure } from "@/lib/units";

export const parenthetical = (note: string) => {
  const trimmed = note.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
  return `(${trimmed})`;
};

export const storedMeasure = () => {
  try {
    const stored = localStorage.getItem("mise-units");
    if (stored === "metric" || stored === "imperial" || stored === "original")
      return stored;
  } catch {
    // storage can be unavailable in private windows.
  }
  return "original";
};

export const saveMeasure = (measure: Measure) => {
  try {
    localStorage.setItem("mise-units", measure);
  } catch {
    // nothing to do; the choice still applies to this page.
  }
};

export const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const sharedLink = (params: URLSearchParams) => {
  for (const field of ["url", "text", "title"]) {
    const value = params.get(field) ?? "";
    const match = value.match(/https?:\/\/[^\s<>"']+/i);
    if (!match) continue;
    const link = match[0].replace(/[),.!?]+$/, "");
    try {
      return new URL(link).toString();
    } catch {
      continue;
    }
  }
  return null;
};

export const safeNext = (raw: string | null) =>
  raw &&
  raw.startsWith("/") &&
  !raw.startsWith("//") &&
  !raw.startsWith("/login")
    ? raw
    : "/";

export const isMeasure = (value: string | null): value is Measure =>
  value === "original" || value === "metric" || value === "imperial";

export const localDay = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const dayFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

export const addDays = (key: string, days: number) => {
  const date = dayFromKey(key);
  date.setDate(date.getDate() + days);
  return localDay(date);
};

export const weekStart = (key: string) => {
  const date = dayFromKey(key);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDay(date);
};
