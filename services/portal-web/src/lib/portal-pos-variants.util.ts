export function splitVariantTokens(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? '').split(/[,;\n]/)) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

type VariantLike = { color?: unknown; size?: unknown; sku?: unknown; id?: unknown };

/** Color × size rows, skipping combinations that are already on the product. */
export function generateColorSizeVariants<T extends VariantLike>(
  existing: T[],
  colors: string[],
  sizes: string[],
  make: (color: string, size: string) => T,
): T[] {
  const key = (color: string, size: string) => `${color.trim().toLowerCase()}|${size.trim().toLowerCase()}`;
  const kept = existing.filter(
    (row) => String(row.color ?? '').trim() || String(row.size ?? '').trim() || String(row.sku ?? '').trim() || String(row.id ?? '').trim(),
  );
  const have = new Set(kept.map((row) => key(String(row.color ?? ''), String(row.size ?? ''))));
  const added: T[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const combo = key(color, size);
      if (have.has(combo)) continue;
      have.add(combo);
      added.push(make(color, size));
    }
  }
  return added.length ? [...kept, ...added] : existing;
}
