import { z } from "zod";
import { aisles, type Aisle } from "./aisles";

export const storeSection = z.object({
  aisle: z.enum(aisles),
  label: z.string().trim().max(24).default(""),
});

/** a store's walking order: each section at most once, in the order you shop it. */
export const storeLayout = z
  .array(storeSection)
  .max(aisles.length)
  .refine(
    (sections) =>
      new Set(sections.map((section) => section.aisle)).size ===
      sections.length,
    "Each section can appear once"
  );

export const storeSchema = z.object({
  id: z.string(),
  name: z.string(),
  layout: storeLayout,
});

export type StoreSection = z.infer<typeof storeSection>;
export type Store = z.infer<typeof storeSchema>;

/** the default walk (aisles in their usual order, no labels). */
export const defaultLayout = () =>
  aisles.map((aisle) => ({ aisle, label: "" }));

/** every section in this store's order; sections it doesn't list go last. */
export const fullLayout = (layout: StoreSection[]) => {
  const listed = new Set(layout.map((section) => section.aisle));
  return [
    ...layout,
    ...aisles
      .filter((aisle) => !listed.has(aisle))
      .map((aisle) => ({ aisle, label: "" })),
  ];
};

/** older installs stored sentence-case aisle names. */
const legacyAisle: Record<string, Aisle> = {
  "Meat & seafood": "Meat & Seafood",
  "Dairy & eggs": "Dairy & Eggs",
  "Spices & seasonings": "Spices & Seasonings",
  "Condiments & sauces": "Condiments & Sauces",
};

export const parseLayout = (raw: string) => {
  try {
    const value = JSON.parse(raw);
    const sections = Array.isArray(value)
      ? value.map((section) =>
          section && typeof section === "object" && "aisle" in section
            ? {
                ...section,
                aisle:
                  legacyAisle[String(section.aisle)] ??
                  (section as { aisle: unknown }).aisle,
              }
            : section
        )
      : value;
    const parsed = storeLayout.safeParse(sections);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const sectionTitle = (section: { aisle: Aisle; label: string }) =>
  section.label ? `${section.aisle} · ${section.label}` : section.aisle;
