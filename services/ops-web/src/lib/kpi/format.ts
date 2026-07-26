/** RNOS-42 — KPI display helpers */

export function formatVnd(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

export function formatPct(value: unknown, digits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN');
}

export function periodLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}
