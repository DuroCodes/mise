import {
  formatAmount,
  fromBase,
  parseAmount,
  pluralCups,
  sameUnit,
  unitInfo,
  unitValue,
} from "../lib/units";

export type Quantity = { amount: string; unit: string };

const singularWord = (word: string) => {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(?:ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word))
    return word.slice(0, -1);
  return word;
};

/** a normalized key used to decide whether two shopping items are the same thing. */
export const itemKey = (name: string) => {
  const words = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const last = words.length - 1;
  words[last] = singularWord(words[last] ?? "");
  return words.join(" ");
};

const isEmpty = (quantity: Quantity) =>
  !quantity.amount.trim() && !quantity.unit.trim();

/**
 * adds two quantities of the same ingredient. Returns null when they cannot be
 * combined honestly (different kinds of unit, ranges, or text amounts), so the
 * caller keeps them as separate lines.
 */
export const combineQuantities = (existing: Quantity, incoming: Quantity) => {
  if (isEmpty(existing) && isEmpty(incoming)) return { amount: "", unit: "" };

  const left = parseAmount(existing.amount);
  const right = parseAmount(incoming.amount);
  if (left === null || right === null) return null;

  if (sameUnit(existing.unit, incoming.unit)) {
    const amount = formatAmount(left + right);
    const unit = existing.unit.trim() ? unitValue(existing.unit) : "";
    return { amount, unit: pluralCups(unit, amount) };
  }

  const from = unitInfo(existing.unit);
  const to = unitInfo(incoming.unit);
  if (!from || !to || from.kind !== to.kind) return null;

  const base = left * from.toBase + right * to.toBase;
  const picked = fromBase(from.kind, base, from.system);
  const amount = formatAmount(picked.amount);
  return { amount, unit: pluralCups(picked.unit, amount) };
};

export const parseSources = (raw: string) => {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};
