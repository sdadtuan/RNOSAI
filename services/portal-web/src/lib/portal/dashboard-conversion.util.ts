import { ctrPercent } from '@/lib/format';
import type { PerformanceListResponse, PerformanceRow } from '@/lib/api';
import { receivedDay, shiftYmd } from '@/lib/portal/dashboard-range';

export type ConversionSourceRow = {
  customer_id?: string | null;
  created_at?: string;
  last_interaction_at?: string;
};

export type ConversionRatio = {
  /** Rows in the selected range that already have a customer_id. */
  converted: number;
  /** All conversations or leads whose received day falls in the range. */
  total: number;
  /** 0–100, or null when there is nothing in the range. */
  percent: number | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  zalo: 'Zalo Ads',
  other: 'Khác',
};

/**
 * Distinct hues so Meta and Zalo are never two similar greens.
 * Meta: portal primary (dark green). Zalo: teal. Google: warm gold.
 */
export const CHANNEL_COLORS: Record<string, string> = {
  meta: '#17692f',
  zalo: '#0d9488',
  google: '#c4a35a',
  other: '#5c6f63',
};

export function channelColor(id: string): string {
  return CHANNEL_COLORS[id] ?? CHANNEL_COLORS.other;
}

/**
 * Conversion = share of conversations / leads received in [from, to] that
 * were turned into a customer (`customer_id` set by "Chuyển thành khách hàng"
 * or by closing an order). The day uses the same `receivedDay` rule as the
 * rest of the dashboard (last_interaction_at, then created_at, Asia/Saigon).
 */
export function conversionRatio(
  rows: ConversionSourceRow[],
  from: string,
  to: string,
  dayOf: (row: ConversionSourceRow) => string = receivedDay,
): ConversionRatio {
  const inRange = rows.filter((row) => {
    const day = dayOf(row);
    return Boolean(day) && day >= from && day <= to;
  });
  const converted = inRange.filter((row) => Boolean(row.customer_id)).length;
  const total = inRange.length;
  return {
    converted,
    total,
    percent: total > 0 ? (converted / total) * 100 : null,
  };
}

export type ChannelSpendSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export function spendByChannel(rows: PerformanceRow[]): ChannelSpendSlice[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = String(row.channel || '').trim().toLowerCase();
    const id = raw && CHANNEL_LABELS[raw] ? raw : raw ? raw : 'other';
    map.set(id, (map.get(id) ?? 0) + (Number(row.spend) || 0));
  }
  return [...map.entries()]
    .map(([id, value]) => ({
      id,
      label: CHANNEL_LABELS[id] ?? id,
      value,
      color: channelColor(id),
    }))
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
}

export type AdsTotals = {
  clicks: number;
  impressions: number;
  spend: number;
  ctr: number | null;
};

export function adsTotalsFromRows(rows: PerformanceRow[]): AdsTotals {
  const clicks = rows.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0);
  const spend = rows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
  return { clicks, impressions, spend, ctr: ctrPercent(clicks, impressions) };
}

/** Prefer the server summary spend (already de-duplicated at campaign level). */
export function adsSummarySpend(performance: PerformanceListResponse | null): number | null {
  if (!performance) return null;
  const fromSummary = performance.summary?.total_spend;
  if (typeof fromSummary === 'number' && !Number.isNaN(fromSummary)) return fromSummary;
  return adsTotalsFromRows(performance.rows).spend;
}

export const PORTAL_ADS_CHANNEL_ORDER = ['meta', 'zalo', 'google'] as const;

export type ChannelCountRow = {
  channel?: string | null;
  campaign_id?: string | null;
  labels?: string[];
  source?: string | null;
  customer_id?: string | null;
  created_at?: string;
  last_interaction_at?: string;
};

export type ChannelBreakdownRow = {
  id: string;
  label: string;
  color: string;
  spend: number;
  percent: number;
  leads: number;
  messages: number;
};

/** Map a care-case or performance row onto a known ads channel id. */
export function adsChannelOf(
  raw?: string | null,
  campaignId?: string | null,
  labels?: string[],
  source?: string | null,
): string {
  const blob = [raw, campaignId, source, ...(labels ?? [])].map((v) => String(v || '').toLowerCase()).join(' ');
  if (blob.includes('zalo')) return 'zalo';
  if (blob.includes('google')) return 'google';
  if (blob.includes('meta') || blob.includes('facebook') || blob.includes('instagram')) return 'meta';
  return 'other';
}

/**
 * One row per connected ads channel (even at 0 ₫ / 0%), plus any extra
 * channel that actually has spend. Percents are of total spend in range.
 */
export function adsChannelBreakdown(opts: {
  connectedIds?: string[] | null;
  spendRows: PerformanceRow[];
  leads?: ChannelCountRow[];
  messages?: ChannelCountRow[];
  from: string;
  to: string;
}): ChannelBreakdownRow[] {
  const spendMap = new Map<string, number>();
  for (const slice of spendByChannel(opts.spendRows)) {
    spendMap.set(slice.id, slice.value);
  }
  const countIn = (rows: ChannelCountRow[] | undefined) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      const day = receivedDay(row);
      if (!day || day < opts.from || day > opts.to) continue;
      const id = adsChannelOf(row.channel, row.campaign_id, row.labels, row.source);
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };
  const leadMap = countIn(opts.leads);
  const messageMap = countIn(opts.messages);

  const ids: string[] = [];
  for (const id of opts.connectedIds ?? []) {
    const key = String(id || '').toLowerCase();
    if (key && !ids.includes(key)) ids.push(key);
  }
  for (const id of PORTAL_ADS_CHANNEL_ORDER) {
    if ((spendMap.get(id) ?? 0) > 0 && !ids.includes(id)) ids.push(id);
  }
  for (const id of spendMap.keys()) {
    if (!ids.includes(id) && id !== 'other') ids.push(id);
  }
  if (!ids.length) {
    for (const id of PORTAL_ADS_CHANNEL_ORDER) {
      if ((spendMap.get(id) ?? 0) > 0 || (leadMap.get(id) ?? 0) > 0 || (messageMap.get(id) ?? 0) > 0) {
        ids.push(id);
      }
    }
  }

  const totalSpend = [...spendMap.values()].reduce((sum, v) => sum + v, 0);
  return ids.map((id) => {
    const spend = spendMap.get(id) ?? 0;
    return {
      id,
      label: ({ meta: 'Meta', zalo: 'Zalo Ads', google: 'Google Ads', other: 'Khác' } as Record<string, string>)[id] ?? id,
      color: channelColor(id),
      spend,
      percent: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
      leads: leadMap.get(id) ?? 0,
      messages: messageMap.get(id) ?? 0,
    };
  });
}
/** Inclusive previous window of the same length, immediately before `from`. */
export function previousEqualWindow(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to || from > to) return null;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (!Number.isFinite(days) || days <= 0) return null;
  const prevTo = shiftYmd(from, -1);
  const prevFrom = shiftYmd(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

/**
 * Relative change as a percent ((current - previous) / previous * 100).
 * Returns null when there is no previous baseline (missing or zero) so the UI can hide it.
 */
export function periodDeltaPct(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Compact VND for inline splits: 16.825.000 → "16,8tr", 956.000 → "956k". */
export function fmtCompactVnd(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number, digits: number) =>
    n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) {
    const tr = value / 1_000_000;
    const digits = Math.abs(tr - Math.round(tr)) < 0.05 ? 0 : 1;
    return `${fmt(tr, digits)}tr`;
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    const digits = abs >= 100_000 ? 0 : 1;
    return `${fmt(k, digits)}k`;
  }
  return fmt(value, 0);
}
