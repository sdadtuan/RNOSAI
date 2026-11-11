export type InsightLevel = 'account' | 'campaign' | 'adset' | 'ad';

export const INSIGHT_LEVELS: InsightLevel[] = ['account', 'campaign', 'adset', 'ad'];

export const BREAKDOWN_TYPES = ['age', 'gender', 'publisher_platform', 'platform_position', 'region'] as const;

export type BreakdownType = (typeof BREAKDOWN_TYPES)[number];

/** Max insight date span (matches PortalMetaInsightsService). */
export const MAX_INSIGHT_RANGE_DAYS = 37 * 30;

/** `last_error` on sync state — fatal insight failures only, never breakdown Graph rejections. */
export function resolveSyncLastError(fatalError: string | null, _breakdownErrors: string[]): string | null {
  return fatalError ?? null;
}

export function summarizeBreakdownWarnings(breakdownErrors: string[], maxItems = 3): string | null {
  if (!breakdownErrors.length) return null;
  return breakdownErrors.slice(0, maxItems).join('; ');
}

export function buildSyncStateFromErrors(
  fatalError: string | null,
  breakdownErrors: string[],
): { last_error: string | null; last_breakdown_warnings: string | null } {
  return {
    last_error: resolveSyncLastError(fatalError, breakdownErrors),
    last_breakdown_warnings: fatalError ? null : summarizeBreakdownWarnings(breakdownErrors),
  };
}

export function graphBreakdownsParam(breakdownType: BreakdownType): string {
  return breakdownType === 'platform_position' ? 'publisher_platform,platform_position' : breakdownType;
}

export function normalizeAdAccountDigits(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^act_/i, '');
}

export function assertLocalDatabaseUrl(databaseUrl: string): void {
  let host = '';
  try {
    host = new URL(databaseUrl.replace(/^postgresql:/, 'http:')).hostname;
  } catch {
    throw new Error('invalid_database_url');
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('refuse_non_local_database');
  }
}

export function isoDateOnly(input: Date): string {
  return input.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateOnly(d);
}

export function chunkDateRange(since: string, until: string, maxDays: number): Array<{ since: string; until: string }> {
  const out: Array<{ since: string; until: string }> = [];
  let cursor = since;
  while (cursor <= until) {
    let end = addDays(cursor, maxDays - 1);
    if (end > until) end = until;
    out.push({ since: cursor, until: end });
    cursor = addDays(end, 1);
  }
  return out;
}

type ActionRow = { action_type?: string; value?: string };

export function parseLeadsFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const item of actions as ActionRow[]) {
    const actionType = String(item?.action_type ?? '').toLowerCase();
    if (!actionType.includes('lead')) continue;
    const n = Number(item?.value ?? 0);
    if (Number.isFinite(n)) total += Math.trunc(n);
  }
  return total;
}

const PURCHASE_TYPES = new Set(['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']);

export function parsePurchases(actions: unknown): { count: number; value: number } {
  if (!Array.isArray(actions)) return { count: 0, value: 0 };
  let count = 0;
  for (const item of actions as ActionRow[]) {
    const t = String(item?.action_type ?? '').toLowerCase();
    if (PURCHASE_TYPES.has(t)) {
      const n = Number(item?.value ?? 0);
      if (Number.isFinite(n)) count += Math.trunc(n);
    }
  }
  return { count, value: 0 };
}

export function parsePurchaseValue(actionValues: unknown): number {
  if (!Array.isArray(actionValues)) return 0;
  let total = 0;
  for (const item of actionValues as ActionRow[]) {
    const t = String(item?.action_type ?? '').toLowerCase();
    if (PURCHASE_TYPES.has(t)) {
      const n = Number(item?.value ?? 0);
      if (Number.isFinite(n)) total += n;
    }
  }
  return total;
}

export function parseRoas(purchaseRoas: unknown): number | null {
  if (!Array.isArray(purchaseRoas) || !purchaseRoas.length) return null;
  const first = purchaseRoas[0] as ActionRow;
  const n = Number(first?.value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export type NormalizedInsightRow = {
  insight_level: InsightLevel;
  performance_date: string;
  external_campaign_id: string;
  external_campaign_name: string | null;
  external_adset_id: string;
  external_adset_name: string | null;
  external_ad_id: string;
  external_ad_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  inline_link_clicks: number | null;
  reach: number | null;
  frequency: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  leads_platform: number;
  conversions: number;
  conversion_value: number;
  raw_insights: Record<string, unknown>;
};

export function normalizeGraphInsightRow(row: Record<string, unknown>, level: InsightLevel): NormalizedInsightRow | null {
  const day = String(row.date_start ?? row.date_stop ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const campaignId = String(row.campaign_id ?? '').trim();
  const adsetId = String(row.adset_id ?? '').trim();
  const adId = String(row.ad_id ?? '').trim();

  let external_campaign_id = campaignId;
  let external_adset_id = adsetId;
  let external_ad_id = adId;
  if (level === 'account') {
    external_campaign_id = '';
    external_adset_id = '';
    external_ad_id = '';
  } else if (level === 'campaign') {
    external_adset_id = '';
    external_ad_id = '';
  } else if (level === 'adset') {
    external_ad_id = '';
  }

  if (level !== 'account' && !external_campaign_id) return null;
  if (level === 'adset' && !external_adset_id) return null;
  if (level === 'ad' && (!external_adset_id || !external_ad_id)) return null;

  const purchases = parsePurchases(row.actions);
  const purchaseValue = parsePurchaseValue(row.action_values);
  const roas = parseRoas(row.purchase_roas);

  const spend = Number(row.spend ?? 0) || 0;
  const impressions = Math.trunc(Number(row.impressions ?? 0) || 0);
  const clicks = Math.trunc(Number(row.clicks ?? 0) || 0);
  const inlineRaw = row.inline_link_clicks;
  const inline_link_clicks =
    inlineRaw === undefined || inlineRaw === null || inlineRaw === '' ? null : Math.trunc(Number(inlineRaw) || 0);

  const reachRaw = row.reach;
  const reach =
    reachRaw === undefined || reachRaw === null || reachRaw === '' ? null : Math.trunc(Number(reachRaw) || 0);
  const freqRaw = row.frequency;
  const frequency =
    freqRaw === undefined || freqRaw === null || freqRaw === '' ? null : Number(freqRaw) || null;

  const numOrNull = (v: unknown): number | null =>
    v === undefined || v === null || v === '' ? null : Number(v) || null;

  const raw: Record<string, unknown> = { ...row };
  if (roas != null) raw._purchase_roas = roas;

  return {
    insight_level: level,
    performance_date: day,
    external_campaign_id,
    external_campaign_name: campaignId ? String(row.campaign_name ?? '') || null : null,
    external_adset_id,
    external_adset_name: adsetId ? String(row.adset_name ?? '') || null : null,
    external_ad_id,
    external_ad_name: adId ? String(row.ad_name ?? '') || null : null,
    spend,
    impressions,
    clicks,
    inline_link_clicks,
    reach,
    frequency,
    cpc: numOrNull(row.cpc),
    cpm: numOrNull(row.cpm),
    ctr: numOrNull(row.ctr),
    leads_platform: parseLeadsFromActions(row.actions),
    conversions: purchases.count,
    conversion_value: purchaseValue,
    raw_insights: raw,
  };
}

export function formatGraphError(body: { error?: Record<string, unknown> } | null | undefined): string {
  const err = body?.error;
  if (!err || typeof err !== 'object') return 'graph_error';
  const message = String(err.message ?? 'Graph API error');
  const code = err.code != null ? String(err.code) : '';
  const sub = err.error_subcode != null ? String(err.error_subcode) : '';
  const type = err.type != null ? String(err.type) : '';
  const fb = err.fbtrace_id != null ? String(err.fbtrace_id) : '';
  return [message, code && `code=${code}`, sub && `error_subcode=${sub}`, type && `type=${type}`, fb && `fbtrace_id=${fb}`]
    .filter(Boolean)
    .join(' | ');
}

export function graphRateLimitWaitMs(headers: Headers): number {
  const bu = headers.get('x-business-use-case-usage') || headers.get('x-app-usage');
  if (!bu) return 0;
  try {
    const parsed = JSON.parse(bu) as Record<string, Array<Record<string, number>>>;
    for (const key of Object.keys(parsed)) {
      const arr = parsed[key];
      if (!Array.isArray(arr) || !arr[0]) continue;
      const u = arr[0];
      const call = Number(u.call_count ?? 0);
      const cpu = Number(u.total_cputime ?? 0);
      const time = Number(u.total_time ?? 0);
      if (call >= 80 || cpu >= 80 || time >= 80) return 8000;
      if (call >= 50 || cpu >= 50 || time >= 50) return 3000;
    }
  } catch {
    return 0;
  }
  return 0;
}
