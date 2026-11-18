/** Color themes; each id is also the class set on <html> (see index.css). */
export const themeOptions = [
  { id: "system", label: "System", swatch: ["", ""] },
  { id: "light", label: "Light", swatch: ["#fbf9f4", "#b8762b"] },
  { id: "dark", label: "Dark", swatch: ["#111111", "#e5a23c"] },
  { id: "espresso", label: "Espresso", swatch: ["#221b16", "#e5a23c"] },
  { id: "herb", label: "Herb", swatch: ["#1a2820", "#7dba6a"] },
] as const;

export const themeIds = themeOptions
  .map((option) => option.id)
  .filter((id) => id !== "system");
