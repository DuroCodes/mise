import { z } from "zod";
import { aisles, type Aisle } from "./aisles";

export const storeSection = z.object({
  aisle: z.enum(aisles),
  label: z.string().trim().max(24).default(""),
});

/** A store's walking order: each section at most once, in the order you shop it. */
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

/** The default walk (aisles in their usual order, no labels). */
export const defaultLayout = (): StoreSection[] =>
  aisles.map((aisle) => ({ aisle, label: "" }));

/** Every section in this store's order; sections it doesn't list go last. */
export const fullLayout = (layout: StoreSection[]): StoreSection[] => {
  const listed = new Set(layout.map((section) => section.aisle));
  return [
    ...layout,
    ...aisles
      .filter((aisle) => !listed.has(aisle))
      .map((aisle) => ({ aisle, label: "" })),
  ];
};

export const parseLayout = (raw: string): StoreSection[] => {
  try {
    const parsed = storeLayout.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const sectionTitle = (section: { aisle: Aisle; label: string }) =>
  section.label ? `${section.aisle} · ${section.label}` : section.aisle;
