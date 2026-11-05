export function dash(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function formatQtVnd(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Theo proposal';
  return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}
