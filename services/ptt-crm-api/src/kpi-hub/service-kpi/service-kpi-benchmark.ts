export function percentile50(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

export function percentile80(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.8) - 1;
  return sorted[Math.max(0, idx)]!;
}

export function budgetBandLabel(minVnd: number | null, maxVnd: number | null): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${Math.round(n / 1_000_000_000)}tỷ`;
    if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}tr`;
    return String(n);
  };
  if (minVnd != null && maxVnd != null) return `${fmt(minVnd)}–${fmt(maxVnd)}`;
  if (maxVnd != null) return fmt(maxVnd);
  if (minVnd != null) return fmt(minVnd);
  return '';
}
