import type { Measure } from "@/lib/units";

export const parenthetical = (note: string) => {
  const trimmed = note.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
  return `(${trimmed})`;
};

export const storedMeasure = (): Measure => {
  try {
    const stored = localStorage.getItem("mise-units");
    if (stored === "metric" || stored === "imperial" || stored === "original")
      return stored;
  } catch {
    // Storage can be unavailable in private windows.
  }
  return "original";
};

export const saveMeasure = (measure: Measure) => {
  try {
    localStorage.setItem("mise-units", measure);
  } catch {
    // Nothing to do; the choice still applies to this page.
  }
};

export const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const isMeasure = (value: string | null): value is Measure =>
  value === "original" || value === "metric" || value === "imperial";

/** Today's date in the viewer's time zone, as YYYY-MM-DD. */
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

/** Monday of the week that contains the given day. */
export const weekStart = (key: string) => {
  const date = dayFromKey(key);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDay(date);
};
