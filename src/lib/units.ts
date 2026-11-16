export type Measure = "original" | "metric" | "imperial";

type Kind = "weight" | "volume" | "length";
type System = "metric" | "imperial";

type Unit = {
  kind: Kind;
  system: System;
  toBase: number;
};

const normalizeUnit = (unit: string) =>
  unit.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");

const catalog = new Map<string, Unit>();

const define = (
  kind: Kind,
  system: System,
  toBase: number,
  names: string[]
) => {
  const unit = { kind, system, toBase };
  for (const name of names) catalog.set(normalizeUnit(name), unit);
};

define("weight", "metric", 1, ["g", "gram", "grams", "gramme", "grammes"]);
define("weight", "metric", 1000, [
  "kg",
  "kilo",
  "kilos",
  "kilogram",
  "kilograms",
]);
define("weight", "imperial", 28.349523125, ["oz", "ounce", "ounces"]);
define("weight", "imperial", 453.59237, ["lb", "lbs", "pound", "pounds"]);

define("volume", "metric", 1, [
  "ml",
  "milliliter",
  "milliliters",
  "millilitre",
  "millilitres",
]);
define("volume", "metric", 1000, ["l", "liter", "liters", "litre", "litres"]);
define("volume", "imperial", 4.92892159375, ["tsp", "teaspoon", "teaspoons"]);
define("volume", "imperial", 14.78676478125, [
  "tbsp",
  "tbs",
  "tbl",
  "tablespoon",
  "tablespoons",
]);
define("volume", "imperial", 29.5735295625, [
  "fl oz",
  "floz",
  "fluid ounce",
  "fluid ounces",
]);
define("volume", "imperial", 236.5882365, ["cup", "cups"]);
define("volume", "imperial", 473.176473, ["pt", "pint", "pints"]);
define("volume", "imperial", 946.352946, ["qt", "quart", "quarts"]);

define("length", "metric", 1, [
  "mm",
  "millimeter",
  "millimeters",
  "millimetre",
  "millimetres",
]);
define("length", "metric", 10, [
  "cm",
  "centimeter",
  "centimeters",
  "centimetre",
  "centimetres",
]);
define("length", "metric", 1000, ["m", "meter", "meters", "metre", "metres"]);
define("length", "imperial", 25.4, ["in", "inch", "inches"]);

export const unitGroups: { label: string; units: string[] }[] = [
  { label: "Weight", units: ["g", "kg", "oz", "lb"] },
  {
    label: "Volume",
    units: ["ml", "L", "tsp", "tbsp", "fl oz", "cup", "pt", "qt"],
  },
  { label: "Length", units: ["mm", "cm", "m", "in"] },
  {
    label: "Count",
    units: [
      "clove",
      "pinch",
      "dash",
      "can",
      "bunch",
      "slice",
      "sprig",
      "stick",
      "package",
      "head",
      "stalk",
    ],
  },
];

const unitChoices = new Set(unitGroups.flatMap((group) => group.units));

const choiceFor = new Map<string, string>();
for (const choice of unitChoices) choiceFor.set(normalizeUnit(choice), choice);
for (const [name, unit] of catalog) {
  for (const choice of unitChoices) {
    if (catalog.get(normalizeUnit(choice)) === unit)
      choiceFor.set(name, choice);
  }
}
for (const [alias, choice] of [
  ["cloves", "clove"],
  ["pinches", "pinch"],
  ["dashes", "dash"],
  ["cans", "can"],
  ["bunches", "bunch"],
  ["slices", "slice"],
  ["sprigs", "sprig"],
  ["sticks", "stick"],
  ["packages", "package"],
  ["heads", "head"],
  ["stalks", "stalk"],
] as const) {
  choiceFor.set(alias, choice);
}

export const unitValue = (raw: string) => {
  const key = normalizeUnit(raw);
  if (!key) return "";
  return choiceFor.get(key) ?? raw;
};

export const isListedUnit = (value: string) => unitChoices.has(value);

const glyphs: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

const fractions: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

export const parseAmount = (raw: string) => {
  const value = raw.trim();
  if (!value) return null;

  const glyph = Object.keys(glyphs).find((mark) => value.includes(mark));
  if (glyph && value.endsWith(glyph)) {
    const whole = value.slice(0, -glyph.length).trim();
    if (!whole) return glyphs[glyph];
    if (/^\d+$/.test(whole)) return Number(whole) + glyphs[glyph];
    return null;
  }

  const mixed = value.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (/^\d+(?:\.\d+)?$/.test(value) || /^\.\d+$/.test(value))
    return Number(value);
  return null;
};

const rangeAmount = (raw: string) => {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
};

const formatRangePart = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value >= 100) return String(Math.round(value));
  const digits = value < 10 ? 2 : 1;
  return String(Number(value.toFixed(digits)));
};

export const formatAmount = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value === 0) return "0";
  if (value >= 100) return String(Math.round(value));

  if (value < 10) {
    const whole = Math.floor(value + 1e-8);
    const rest = value - whole;
    let closest: [number, string] | null = null;
    let gap = 0.012;
    for (const fraction of fractions) {
      const next = Math.abs(rest - fraction[0]);
      if (next <= gap) {
        closest = fraction;
        gap = next;
      }
    }
    if (closest && rest > 0.02) {
      return whole === 0 ? closest[1] : `${whole} ${closest[1]}`;
    }
  }

  if (Math.abs(value - Math.round(value)) < 0.05)
    return String(Math.round(value));
  return String(Number(value.toFixed(value < 1 ? 2 : 1)));
};

const adjustUnit = (unit: string, amount: string) => {
  const key = normalizeUnit(unit);
  if (key === "cup" || key === "cups") {
    return amount === "1" ? "cup" : "cups";
  }
  return unit;
};

const pickMetric = (kind: Kind, base: number) => {
  if (kind === "weight") {
    if (base >= 1000) return { amount: base / 1000, unit: "kg" };
    return { amount: base, unit: "g" };
  }
  if (kind === "volume") {
    if (base >= 1000) return { amount: base / 1000, unit: "L" };
    return { amount: base, unit: "ml" };
  }
  if (base >= 1000) return { amount: base / 1000, unit: "m" };
  if (base >= 10) return { amount: base / 10, unit: "cm" };
  return { amount: base, unit: "mm" };
};

const pickImperial = (kind: Kind, base: number) => {
  if (kind === "weight") {
    if (base >= 453.59237) return { amount: base / 453.59237, unit: "lb" };
    return { amount: base / 28.349523125, unit: "oz" };
  }
  if (kind === "volume") {
    const cups = base / 236.5882365;
    if (cups >= 0.25)
      return { amount: cups, unit: Math.abs(cups - 1) < 0.03 ? "cup" : "cups" };
    const tablespoons = base / 14.78676478125;
    if (tablespoons >= 1) return { amount: tablespoons, unit: "tbsp" };
    return { amount: base / 4.92892159375, unit: "tsp" };
  }
  return { amount: base / 25.4, unit: "in" };
};

export const scaleIngredient = <
  T extends { amount: string; unit: string; note?: string },
>(
  item: T,
  factor: number,
  measure: Measure
) => {
  if (!Number.isFinite(factor) || factor <= 0) return item;

  const scaled = scaleQuantity(item.amount, item.unit, factor, measure);
  const note =
    typeof item.note === "string"
      ? scaleNote(item.note, factor, measure)
      : item.note;
  if (!scaled && note === item.note) return item;
  return {
    ...item,
    amount: scaled?.amount ?? item.amount,
    unit: scaled?.unit ?? item.unit,
    ...(note === undefined ? {} : { note }),
  };
};

const scaleQuantity = (
  amount: string,
  unit: string,
  factor: number,
  measure: Measure
) => {
  const range = rangeAmount(amount);
  if (range) {
    const low = convertAmount(range.low, unit, factor, measure);
    const high = convertAmount(range.high, unit, factor, measure, low.unit);
    return {
      amount: `${formatRangePart(low.amount)}-${formatRangePart(high.amount)}`,
      unit: adjustUnit(low.unit, "2"),
    };
  }

  const parsed = parseAmount(amount);
  if (parsed === null) return null;
  const converted = convertAmount(parsed, unit, factor, measure);
  const formatted = formatAmount(converted.amount);
  return { amount: formatted, unit: adjustUnit(converted.unit, formatted) };
};

const convertAmount = (
  value: number,
  unit: string,
  factor: number,
  measure: Measure,
  forceUnit?: string
) => {
  const scaled = value * factor;
  const known = catalog.get(normalizeUnit(unit));
  if (!known || measure === "original" || known.system === measure) {
    return { amount: scaled, unit };
  }

  const base = scaled * known.toBase;
  if (forceUnit) {
    const forced = catalog.get(normalizeUnit(forceUnit));
    if (forced && forced.kind === known.kind)
      return { amount: base / forced.toBase, unit: forceUnit };
  }
  const picked =
    measure === "metric"
      ? pickMetric(known.kind, base)
      : pickImperial(known.kind, base);
  return picked;
};

const scaleNote = (note: string, factor: number, measure: Measure) =>
  note.replace(
    /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s+([A-Za-z][A-Za-z ]*?)(?=,|$)/,
    (whole, low, high, unit: string) => {
      const scaled = scaleQuantity(
        `${low}-${high}`,
        unit.trim(),
        factor,
        measure
      );
      if (!scaled) return whole;
      return `${scaled.amount} ${scaled.unit}`;
    }
  );

export type UnitInfo = { kind: Kind; system: System; toBase: number };

export const unitInfo = (unit: string): UnitInfo | null =>
  catalog.get(normalizeUnit(unit)) ?? null;

export const fromBase = (kind: Kind, base: number, system: System) =>
  system === "metric" ? pickMetric(kind, base) : pickImperial(kind, base);

export const sameUnit = (left: string, right: string) =>
  normalizeUnit(unitValue(left)) === normalizeUnit(unitValue(right));

export const pluralCups = adjustUnit;
