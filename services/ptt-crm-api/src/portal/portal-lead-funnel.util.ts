export type LeadFunnelKpis = {
  total: number;
  waiting: number;
  assigned: number;
  received: number;
  converted: number;
  purchased: number;
  today: number;
  ratio: number;
};

export type LeadFunnelBreakdownRow = {
  id: string;
  label: string;
  total: number;
  received: number;
  converted: number;
  purchased: number;
  ratio: number;
};

export type LeadFunnelFilter = {
  from?: string;
  to?: string;
  pageId?: string;
  channel?: string;
  formId?: string;
  assignee?: string;
  tag?: string;
};

export const CHANNEL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  google: 'Google',
  tiktok: 'TikTok',
};

export function channelLabel(channel: string): string {
  const key = String(channel || '').trim().toLowerCase();
  if (!key) return 'Không rõ kênh';
  return CHANNEL_LABELS[key] || channel;
}

export function leadFunnelRatio(converted: number, total: number): number {
  if (!total || total <= 0) return 0;
  return converted / total;
}

export function formatLeadFunnelRatio(converted: number, total: number): string {
  if (!total || total <= 0) return '0%';
  const pct = (converted / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toLocaleString('vi-VN')}%`;
}

export function emptyLeadFunnelKpis(): LeadFunnelKpis {
  return { total: 0, waiting: 0, assigned: 0, received: 0, converted: 0, purchased: 0, today: 0, ratio: 0 };
}

export function kpisFromCounts(input: Omit<LeadFunnelKpis, 'ratio'>): LeadFunnelKpis {
  return { ...input, ratio: leadFunnelRatio(input.converted, input.total) };
}

/** A "received" lead has left the waiting queue (received / caring / purchased). */
export function isLeadReceivedStatus(status: string): boolean {
  return status === 'received' || status === 'caring' || status === 'purchased';
}

export function breakdownRow(id: string, label: string, counts: { total: number; received: number; converted: number; purchased: number }): LeadFunnelBreakdownRow {
  return {
    id,
    label,
    total: counts.total,
    received: counts.received,
    converted: counts.converted,
    purchased: counts.purchased,
    ratio: leadFunnelRatio(counts.converted, counts.total),
  };
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeYmd(value?: string): string {
  const raw = String(value || '').trim();
  return YMD.test(raw) ? raw : '';
}

export function sanitizeFunnelFilter(query: LeadFunnelFilter): LeadFunnelFilter {
  const from = sanitizeYmd(query.from);
  const to = sanitizeYmd(query.to);
  const start = from && to && to < from ? to : from;
  const end = from && to && to < from ? from : to;
  return {
    from: start,
    to: end,
    pageId: String(query.pageId || '').trim(),
    channel: String(query.channel || '').trim(),
    formId: String(query.formId || '').trim(),
    assignee: String(query.assignee || '').trim(),
    tag: String(query.tag || '').trim(),
  };
}
