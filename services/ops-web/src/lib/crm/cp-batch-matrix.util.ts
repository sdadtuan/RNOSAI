export type CpBatchMatrix = {
  ratios?: string[];
  locales?: string[];
  ctas?: string[];
  channels?: string[];
};

function normalize(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text || out.includes(text)) continue;
    out.push(text);
  }
  return out;
}

export function matrixExpansionCount(
  baseRowCount: number,
  matrix?: CpBatchMatrix | null,
): number {
  if (baseRowCount <= 0) return 0;
  const ratioN = Math.max(1, normalize(matrix?.ratios).length || 1);
  const localeN = Math.max(1, normalize(matrix?.locales).length || 1);
  const channelN = Math.max(1, normalize(matrix?.channels).length || 1);
  const ctaN = normalize(matrix?.ctas).length || 1;
  return baseRowCount * ratioN * localeN * channelN * ctaN;
}
