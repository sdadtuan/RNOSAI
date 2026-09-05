export function showAmNotifyDot(unread: number): boolean {
  return Number(unread) > 0;
}

const KIND_LABELS: Record<string, string> = {
  'sla.breached': 'SLA',
  escalation: 'SLA',
  'renewal.ending': 'Gia hạn',
  'health.drop': 'Health',
  'invoice.paid': 'Hóa đơn',
};

export function amNotifyKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
