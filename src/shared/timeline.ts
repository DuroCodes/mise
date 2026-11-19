export type Temperature = {
  start: number;
  end: number;
  value: number;
  scale: "F" | "C";
};

const temperaturePattern =
  /(\d{2,3})(?:\s*(℉|℃)|(?:\s*(?:°|º)\s*|\s*degrees?\s+|)(F|C|Fahrenheit|Celsius)\b)/gi;

/** oven-style temperatures such as "400°F", "300℉", "425F", "200 °C", or "180 degrees Celsius". */
export const findTemperatures = (text: string) => {
  const found: Temperature[] = [];
  for (const match of text.matchAll(temperaturePattern)) {
    const value = Number(match[1]);
    const scale = match[2]
      ? match[2] === "℉"
        ? "F"
        : "C"
      : (match[3] ?? "").toUpperCase().startsWith("F")
        ? "F"
        : "C";
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
