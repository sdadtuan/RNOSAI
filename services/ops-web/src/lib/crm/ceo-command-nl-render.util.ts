export function rowsToTable(rows: unknown[], max = 12): Array<Record<string, string>> {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, max).map((row) => {
    if (!row || typeof row !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = v == null ? '' : String(v);
    }
    return out;
  });
}

export function sparkPoints(values: number[]): string {
  if (!values.length) return '';
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
