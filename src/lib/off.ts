// Open Food Facts: free, open database of packaged food (ODbL). No account or key.
// Limits are per IP address, so every phone has its own: 15 product lookups and
// 10 searches per minute. Products are cached on the device after the first lookup.

import type { NutrientKey, Nutrients } from './nutrition';

const API = 'https://world.openfoodfacts.org';
const SEARCH = 'https://search.openfoodfacts.org/search';
const FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
  'image_front_url',
].join(',');

export type OffProduct = {
  barcode: string;
  name: string;
  brand: string;
  per100: Nutrients;
  servingG: number | null;
  servingLabel: string | null;
  /** Package photo on Open Food Facts (CC BY-SA). */
  image: string | null;
  /** Nutrition facts missing (product exists but nobody entered them yet). */
  incomplete: boolean;
};

type Raw = {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
  image_front_small_url?: string;
  image_front_url?: string;
};

// Open Food Facts stores minerals and vitamins in grams per 100 g.
const MAP: [NutrientKey, string, number][] = [
  ['protein', 'proteins_100g', 1],
  ['carbs', 'carbohydrates_100g', 1],
  ['sugar', 'sugars_100g', 1],
  ['fat', 'fat_100g', 1],
  ['satFat', 'saturated-fat_100g', 1],
  ['fiber', 'fiber_100g', 1],
  ['salt', 'salt_100g', 1],
  ['potassium', 'potassium_100g', 1000],
  ['calcium', 'calcium_100g', 1000],
  ['magnesium', 'magnesium_100g', 1000],
  ['iron', 'iron_100g', 1000],
  ['zinc', 'zinc_100g', 1000],
  ['vitC', 'vitamin-c_100g', 1000],
  ['vitD', 'vitamin-d_100g', 1_000_000],
  ['vitB12', 'vitamin-b12_100g', 1_000_000],
];

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Turns an Open Food Facts product into per-100 g nutrients. Exported for tests. */
export function parseProduct(raw: Raw): OffProduct | null {
  const barcode = raw.code?.trim();
  const name = (raw.product_name_de || raw.product_name || raw.product_name_en || raw.generic_name || '').trim();
  if (!barcode || !name) return null;
  const n = raw.nutriments ?? {};
  const per100: Nutrients = {};
  const kcal = num(n['energy-kcal_100g']);
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  if (kcal != null) per100.kcal = kcal;
  else if (kj != null) per100.kcal = Math.round((kj / 4.184) * 10) / 10;
  for (const [key, field, factor] of MAP) {
    const v = num(n[field]);
    if (v != null) per100[key] = Math.round(v * factor * 1000) / 1000;
  }
  if (per100.salt == null) {
    const sodium = num(n['sodium_100g']);
    if (sodium != null) per100.salt = Math.round(sodium * 2.5 * 1000) / 1000;
  }
  const brands = Array.isArray(raw.brands) ? raw.brands.join(', ') : (raw.brands ?? '');
  const servingG = num(raw.serving_quantity);
  return {
    barcode,
    name,
    brand: brands.split(',')[0]?.trim() ?? '',
    per100,
    servingG: servingG && servingG > 0 ? servingG : null,
    servingLabel: raw.serving_size?.trim() || null,
    image: (raw.image_front_url || raw.image_front_small_url || '').replace(/^http:/, 'https:') || null,
    incomplete: per100.kcal == null || per100.protein == null,
  };
}

export class OffError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'limit' | 'server',
  ) {
    super(message);
  }
}

async function get(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new OffError('No connection to Open Food Facts.', 'offline');
  }
  if (res.status === 429) throw new OffError('Too many requests. Wait a minute and try again.', 'limit');
  if (res.status === 404) return null;
  if (!res.ok) throw new OffError(`Open Food Facts answered ${res.status}.`, 'server');
  return res.json();
}

/** Valid EAN-13, EAN-8, UPC-A or UPC-E. */
export function isBarcode(text: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(text.trim());
}

/** Looks up one product by barcode. Null when Open Food Facts doesn't know it. */
export async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  const code = barcode.trim();
  const data = (await get(`${API}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`)) as {
    status?: number;
    product?: Raw;
  } | null;
  if (!data || data.status === 0 || !data.product) return null;
  return parseProduct({ ...data.product, code: data.product.code ?? code });
}

let lastSearches: number[] = [];

/** Text search. Rate-limited on our side too, so we never get the IP blocked. */
export async function searchProducts(query: string): Promise<OffProduct[]> {
  const now = Date.now();
  lastSearches = lastSearches.filter((t) => now - t < 60_000);
  if (lastSearches.length >= 8) throw new OffError('Searching a lot right now. Wait a minute and try again.', 'limit');
  lastSearches.push(now);

  const q = query.trim();
  let hits: Raw[] = [];
  try {
    const data = (await get(`${SEARCH}?q=${encodeURIComponent(q)}&page_size=24&langs=de,en&fields=${FIELDS}`)) as {
      hits?: Raw[];
    } | null;
    hits = data?.hits ?? [];
  } catch (e) {
    if (e instanceof OffError && e.kind === 'limit') throw e;
    // Fall back to the classic search endpoint.
    try {
      const data = (await get(
        `${API}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=24&fields=${FIELDS}`,
      )) as { products?: Raw[] } | null;
      hits = data?.products ?? [];
    } catch (e2) {
      if (e2 instanceof OffError && e2.kind === 'limit') throw e2;
      throw new OffError(
        'Product search is not reachable right now. Scanning the barcode (or typing its numbers) still works.',
        'offline',
      );
    }
  }
  const seen = new Set<string>();
  const out: OffProduct[] = [];
  for (const h of hits) {
    const p = parseProduct(h);
    if (!p || seen.has(p.barcode) || p.per100.kcal == null) continue;
    seen.add(p.barcode);
    out.push(p);
  }
  return out;
}
