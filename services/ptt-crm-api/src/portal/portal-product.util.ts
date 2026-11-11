export type ProductColor = { name: string; image: string };
export type ProductOption = { name: string; values: string[] };
export type ProductSpec = {
  price_vnd: number | null;
  colors: ProductColor[];
  sizes: string[];
  options: ProductOption[];
};

const MEDIA = /^\/api\/portal\/crm\/media\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export function emptyProductSpec(): ProductSpec {
  return { price_vnd: null, colors: [], sizes: [], options: [] };
}

export function parseProductSpec(raw: unknown): ProductSpec {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      value = {};
    }
  }
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return normalizeProductSpec(source);
}

export function normalizeProductSpec(input: {
  price_vnd?: unknown;
  image_url?: unknown;
  colors?: unknown;
  sizes?: unknown;
  options?: unknown;
}): ProductSpec {
  const price = Number(input.price_vnd);
  const colors = Array.isArray(input.colors) ? input.colors : [];
  const cleanColors: ProductColor[] = [];
  for (const item of colors.slice(0, 12)) {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const name = String(row.name ?? '').trim().slice(0, 40);
    const image = String(row.image ?? '').trim().slice(0, 500);
    if (!name || !allowedImage(image)) continue;
    cleanColors.push({ name, image });
  }
  const legacy = String(input.image_url ?? '').trim();
  if (!cleanColors.length && allowedImage(legacy)) cleanColors.push({ name: 'Ảnh', image: legacy });
  const sizes = uniqueStrings(input.sizes, 24, 16);
  const options: ProductOption[] = [];
  if (Array.isArray(input.options)) {
    for (const item of input.options.slice(0, 8)) {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const name = String(row.name ?? '').trim().slice(0, 40);
      const values = uniqueStrings(row.values, 16, 40);
      if (name && values.length) options.push({ name, values });
    }
  }
  return {
    price_vnd: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    colors: cleanColors,
    sizes,
    options,
  };
}

function allowedImage(value: string): boolean {
  return /^https:\/\//i.test(value) || MEDIA.test(value);
}

function uniqueStrings(raw: unknown, max: number, length: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    const value = String(item ?? '').trim().slice(0, length);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}
