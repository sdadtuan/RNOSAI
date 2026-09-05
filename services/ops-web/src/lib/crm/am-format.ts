export type AmHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';

export function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n);
}

export function bandCopy(band: AmHealthBand | null | undefined): string {
  if (band === 'healthy') return 'Khỏe mạnh';
  if (band === 'watch') return 'Cần theo dõi';
  if (band === 'at_risk') return 'Có rủi ro';
  if (band === 'critical') return 'Nghiêm trọng';
  return '—';
}

export function vnd(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('vi-VN');
}
