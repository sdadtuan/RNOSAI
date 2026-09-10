export type DeliverableRow = {
  id: number;
  master_id?: number | null;
  display_code?: string | null;
  title?: string;
  format?: string;
  channel?: string;
};

export function filterMasterDeliverables<T extends DeliverableRow>(
  items: T[],
  currentId: number,
): T[] {
  return items.filter((row) => row.id === currentId || row.master_id === currentId);
}

export function deliverableFormatChannel(row: Pick<DeliverableRow, 'format' | 'channel'>): string {
  const format = String(row.format ?? '').trim();
  const channel = String(row.channel ?? '').trim();
  if (!format && !channel) return '';
  return [format, channel].filter(Boolean).join(' / ');
}
