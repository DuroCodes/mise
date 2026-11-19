export type StepTimer = {
  start: number;
  end: number;
  /** low end of a range: when to start checking. */
  seconds: number;
  /** high end of a range (same as seconds otherwise): for planning. */
  upperSeconds: number;
  label: string;
};

const words: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  sixty: 60,
};

const numberPart =
  "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|forty-five|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)";
const unitPart = "(seconds?|secs?|minutes?|mins?|hours?|hrs?)";

const pattern = new RegExp(
  `\\b(${numberPart})(?:\\s*(?:-|–|—|to)\\s*(${numberPart}))?\\s*${unitPart}\\b(?:,?\\s*(?:and\\s+)?(\\d+)\\s*(minutes?|mins?))?`,
  "gi"
);

const toNumber = (raw: string) => {
  const value = raw.trim().toLowerCase();
  if (value in words) return words[value] ?? null;
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator
      ? Number(mixed[1]) + Number(mixed[2]) / denominator
      : null;
  }
  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const unitSeconds = (unit: string) => {
  const value = unit.toLowerCase();
  if (value.startsWith("h")) return 3600;
  if (value.startsWith("m")) return 60;
  return 1;
};

/**
 * finds durations such as "10 minutes", "5 to 7 min", or "1 hour 30 minutes"
 * in a step. A range uses its low end, so the timer goes off when it is time
 * to start checking.
 */
export const findTimers = (text: string) => {
  const found: StepTimer[] = [];
  for (const match of text.matchAll(pattern)) {
    const low = toNumber(match[1] ?? "");
    const unit = match[3] ?? "";
    if (low === null || low <= 0) continue;
    let seconds = low * unitSeconds(unit);
    const extra = match[4] ? Number(match[4]) : 0;
    if (extra && unitSeconds(unit) === 3600) seconds += extra * 60;
    seconds = Math.round(seconds);
    if (seconds < 1 || seconds > 24 * 3600) continue;
    const high = match[2] ? toNumber(match[2]) : null;
    const upperSeconds =
      high !== null && high > low
        ? Math.min(
            24 * 3600,
            Math.round(
              high * unitSeconds(unit) + (seconds - low * unitSeconds(unit))
            )
          )
        : seconds;
    const start = match.index ?? 0;
    found.push({
      start,
      end: start + match[0].length,
      seconds,
      upperSeconds,
      label: match[0],
    });
  }
  return found;
};

export const formatClock = (total: number) => {
  const seconds = Math.max(0, Math.ceil(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`;
};
