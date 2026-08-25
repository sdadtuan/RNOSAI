import type { LeadRow } from '@/lib/api';
import { KANBAN_STAGE_SETS } from './kanban-card-cta';

export type LeadSignalKpiKey = 'hot' | 'consult' | 'ai' | 'won';

export type LeadSignalKpi = {
  key: LeadSignalKpiKey;
  label: string;
  count: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function leadWhen(row: Pick<LeadRow, 'received_at' | 'created_at'>): number {
  const raw = row.received_at || row.created_at;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function leadSignalKpis(
  rows: Array<Pick<LeadRow, 'ai_band' | 'status' | 'received_at' | 'created_at'>>,
  now: Date = new Date(),
): LeadSignalKpi[] {
  const weekStart = now.getTime() - WEEK_MS;
  let hot = 0;
  let consult = 0;
  let ai = 0;
  let won = 0;
  for (const row of rows) {
    const status = String(row.status ?? 'moi');
    if (row.ai_band === 'hot') hot += 1;
    if (KANBAN_STAGE_SETS.consult.has(status)) consult += 1;
    if (KANBAN_STAGE_SETS.quote.has(status)) ai += 1;
    if (KANBAN_STAGE_SETS.won.has(status) && leadWhen(row) >= weekStart) won += 1;
  }
  return [
    { key: 'hot', label: 'Nóng — gọi ngay', count: hot },
    { key: 'consult', label: 'Chờ tư vấn', count: consult },
    { key: 'ai', label: 'AI đề xuất', count: ai },
    { key: 'won', label: 'Won tuần này', count: won },
  ];
}
