import { findTimers } from "./timers";

export type TimelineStep = {
  index: number;
  /** planned start, as epoch ms. */
  start: number;
  minutes: number;
  /** false when the step names no time and the default gap was used. */
  timed: boolean;
};

export type Timeline = {
  steps: TimelineStep[];
  start: number;
  end: number;
  minutes: number;
};

/** minutes a step takes: every duration in it, back to back, using the top of any range. */
export const stepMinutes = (text: string) => {
  const timers = findTimers(text);
  if (!timers.length) return null;
  const seconds = timers.reduce(
    (total, timer) => total + timer.upperSeconds,
    0
  );
  return Math.max(1, Math.round(seconds / 60));
};

/**
 * lays the steps out on a clock. "start" plans forward from the anchor time;
 * "ready" plans backwards so the last step finishes at the anchor. Steps
 * without a time take `gapMinutes`.
 */
export const buildTimeline = (
  steps: { text: string }[],
  anchor: number,
  mode: "start" | "ready",
  gapMinutes = 5
) => {
  const durations = steps.map((step) => {
    const minutes = stepMinutes(step.text);
    return { minutes: minutes ?? gapMinutes, timed: minutes !== null };
  });
  const total = durations.reduce((sum, step) => sum + step.minutes, 0);
  const start = mode === "start" ? anchor : anchor - total * 60_000;
  let cursor = start;
  const planned = durations.map((step, index) => {
    const entry = {
      index,
      start: cursor,
      minutes: step.minutes,
      timed: step.timed,
    };
    cursor += step.minutes * 60_000;
    return entry;
  });
  return { steps: planned, start, end: cursor, minutes: total };
};

export type Temperature = {
  start: number;
  end: number;
  value: number;
  scale: "F" | "C";
};

const temperaturePattern =
  /(\d{2,3})(?:\s*(?:°|º)\s*|\s*degrees?\s+|)(F|C|Fahrenheit|Celsius)\b/gi;

/** oven-style temperatures such as "400°F", "425F", "200 °C", or "180 degrees Celsius". */
export const findTemperatures = (text: string) => {
  const found: Temperature[] = [];
  for (const match of text.matchAll(temperaturePattern)) {
    const value = Number(match[1]);
    const scale = (match[2] ?? "").toUpperCase().startsWith("F") ? "F" : "C";
    // skip things that can't be cooking temperatures.
    if (scale === "F" ? value < 80 || value > 600 : value < 25 || value > 320)
      continue;
    const start = match.index ?? 0;
    found.push({ start, end: start + match[0].length, value, scale });
  }
  return found;
};

/** converts and rounds the way recipes print them (oven temps to the nearest 5). */
export const convertTemperature = (value: number, from: "F" | "C") => {
  const raw = from === "F" ? ((value - 32) * 5) / 9 : (value * 9) / 5 + 32;
  const rounded = raw >= 100 ? Math.round(raw / 5) * 5 : Math.round(raw);
  return {
    value: rounded,
    scale: from === "F" ? ("C" as const) : ("F" as const),
  };
};
