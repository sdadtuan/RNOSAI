const REASON_LABELS: Record<string, string> = {
  pre_b2_hold_expired: 'Hết hạn giữ, chuyển người',
};

export function careHistoryEventLabel(event: string): string {
  if (event === 'recalled') return 'Bị thu hồi';
  if (event === 'holding') return 'Đang giữ';
  return 'Đã gán';
}

export function careHistoryReason(reason: string): string {
  const raw = reason.trim();
  if (!raw) return '';
  if (REASON_LABELS[raw]) return REASON_LABELS[raw];
  if (/^[a-z0-9_:-]+$/i.test(raw)) return 'Chuyển người phụ trách';
  return raw;
}
