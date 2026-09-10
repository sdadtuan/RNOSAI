export type CpBatchMatrix = {
  ratios?: string[];
  locales?: string[];
  ctas?: string[];
  channels?: string[];
};

export function normalizeMatrixValues(values: unknown): string[] {
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
  const ratios = normalizeMatrixValues(matrix?.ratios);
  const locales = normalizeMatrixValues(matrix?.locales);
  const ctas = normalizeMatrixValues(matrix?.ctas);
  const channels = normalizeMatrixValues(matrix?.channels);
  const ratioN = Math.max(1, ratios.length || 1);
  const localeN = Math.max(1, locales.length || 1);
  const channelN = Math.max(1, channels.length || 1);
  const ctaN = ctas.length ? ctas.length : 1;
  return baseRowCount * ratioN * localeN * channelN * ctaN;
}

export function expandBatchMatrix(
  rows: Record<string, unknown>[],
  matrix?: CpBatchMatrix | null,
): Record<string, unknown>[] {
  if (!rows.length) return [];

  const ratios = normalizeMatrixValues(matrix?.ratios);
  const locales = normalizeMatrixValues(matrix?.locales);
  const ctas = normalizeMatrixValues(matrix?.ctas);
  const channels = normalizeMatrixValues(matrix?.channels);

  const ratioList = ratios.length ? ratios : [null];
  const localeList = locales.length ? locales : [null];
  const channelList = channels.length ? channels : [null];

  const expanded: Record<string, unknown>[] = [];
  let rowNo = 1;
  for (const base of rows) {
    for (const ratio of ratioList) {
      for (const locale of localeList) {
        for (const channel of channelList) {
          const ctaList = ctas.length
            ? ctas
            : [String(base.cta ?? '').trim()].filter(Boolean);
          const ctasToUse = ctaList.length ? ctaList : [''];
          for (const cta of ctasToUse) {
            const next: Record<string, unknown> = { ...base, row_no: rowNo };
            if (ratio) next.ratio = ratio;
            if (locale) next.locale = locale;
            if (channel) next.channel = channel;
            if (cta) next.cta = cta;
            next.variant_key = [
              ratio ?? base.ratio ?? '9:16',
              locale ?? base.locale ?? 'vi',
              channel ?? base.channel ?? 'meta',
              cta || base.cta || 'cta',
            ].join('|');
            expanded.push(next);
            rowNo += 1;
          }
        }
      }
    }
  }
  return expanded;
}
