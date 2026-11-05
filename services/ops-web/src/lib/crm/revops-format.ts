export type RevopsAttainmentTag = 'On track' | 'Accelerator' | 'Need attention' | 'At risk' | '—';

export function formatRevopsVnd(n: number | null): string {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
}

export function formatRevopsVndCompact(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000_000) {
    const ty = n / 1_000_000_000;
    return `${ty.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `${Math.round(n / 1_000_000).toLocaleString('vi-VN')} tr`;
  }
  return formatRevopsVnd(n);
}

export function formatRevopsPct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

export function attainmentTag(pct: number | null): RevopsAttainmentTag {
  if (pct == null) return '—';
  if (pct >= 110) return 'Accelerator';
  if (pct >= 90) return 'On track';
  if (pct >= 70) return 'Need attention';
  return 'At risk';
}

export function revopsTagClass(tag: RevopsAttainmentTag | string): string {
  switch (tag) {
    case 'Accelerator':
    case 'On track':
      return 'revops-tag revops-tag--green';
    case 'Need attention':
      return 'revops-tag revops-tag--orange';
    case 'At risk':
      return 'revops-tag revops-tag--red';
    default:
      return 'revops-tag revops-tag--gray';
  }
}

export function formatRevopsDeltaPct(n: number | null): string | null {
  if (n == null) return null;
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n * 10) / 10}%`;
}
