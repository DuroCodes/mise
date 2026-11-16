/**
 * Barcode lookups through Open Food Facts (a free, public product database).
 * Only the barcode number is sent. Results are cached in memory.
 */
export type Product = { name: string; brand: string; quantity: string };

export const barcodeShape = /^\d{8,14}$/;

const cache = new Map<string, Product | null>();
const maxCached = 2000;

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 120) : "";

const remember = (code: string, product: Product | null) => {
  if (cache.size >= maxCached) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(code, product);
};

export const lookupBarcode = async (
  code: string
): Promise<{ ok: true; product: Product | null } | { ok: false }> => {
  if (!barcodeShape.test(code)) return { ok: true, product: null };
  if (cache.has(code)) return { ok: true, product: cache.get(code) ?? null };
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,quantity`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(6000),
        headers: {
          accept: "application/json",
          "user-agent": "Mise/0.1 (self-hosted recipe manager)",
        },
      }
    );
    if (response.status === 404) {
      remember(code, null);
      return { ok: true, product: null };
    }
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as {
      status?: unknown;
      product?: Record<string, unknown>;
    };
    const item = body.product;
    const name =
      clean(item?.product_name_en) ||
      clean(item?.product_name) ||
      clean(item?.generic_name);
    const product =
      body.status === 1 && name
        ? {
            name,
            brand: clean(item?.brands).split(",")[0]?.trim() ?? "",
            quantity: clean(item?.quantity),
          }
        : null;
    remember(code, product);
    return { ok: true, product };
  } catch {
    return { ok: false };
  }
};
