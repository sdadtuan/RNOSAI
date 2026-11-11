import {
  BREAKDOWN_TYPES,
  BreakdownType,
  formatGraphError,
  graphBreakdownsParam,
  graphRateLimitWaitMs,
  InsightLevel,
  normalizeGraphInsightRow,
  NormalizedInsightRow,
} from './portal-meta-insights.util';
import { noteGraphError, noteGraphHeaders, recordGraphCall, shouldPauseGraph } from '../portal/portal-graph-usage';

const GRAPH_VER = 'v21.0';
const BASE_FIELDS =
  'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,cpp,actions,action_values,cost_per_action_type,conversions,purchase_roas,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop';

const RATE_LIMIT_CODES = new Set([17, 4, 80004, 613, 32]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GraphFetchResult =
  | { ok: true; rows: NormalizedInsightRow[] }
  | { ok: false; error: string; retryable?: boolean };

async function graphGet(url: string, accessToken: string, attempt = 0): Promise<Response> {
  const maxAttempts = 6;
  const sep = url.includes('?') ? '&' : '?';
  const full =
    url.includes('access_token=') ? url : `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;
  if (shouldPauseGraph()) {
    throw new Error('Facebook tam dung goi API vi gan dat gioi han.');
  }
  recordGraphCall('insights');
  let response: Response;
  try {
    response = await fetch(full, { signal: AbortSignal.timeout(120000) });
  } catch (err) {
    if (attempt < maxAttempts - 1) {
      await sleep(1000 * (attempt + 1));
      return graphGet(url, accessToken, attempt + 1);
    }
    throw err;
  }
  noteGraphHeaders(response.headers);
  const wait = graphRateLimitWaitMs(response.headers);
  if (wait > 0 && attempt < maxAttempts - 1) {
    await sleep(wait);
    return graphGet(url, accessToken, attempt + 1);
  }
  if (response.status === 429 && attempt < maxAttempts - 1) {
    await sleep(2000 * (attempt + 1));
    return graphGet(url, accessToken, attempt + 1);
  }
  return response;
}

async function fetchPagedInsights(
  accessToken: string,
  accountDigits: string,
  level: InsightLevel,
  since: string,
  until: string,
  extraParams: Record<string, string> = {},
): Promise<GraphFetchResult> {
  const act = `act_${accountDigits}`;
  const params = new URLSearchParams({
    fields: BASE_FIELDS,
    level,
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    ...extraParams,
  });
  let url = `https://graph.facebook.com/${GRAPH_VER}/${act}/insights?${params.toString()}`;
  const rows: NormalizedInsightRow[] = [];

  for (let hop = 0; hop < 200 && url; hop += 1) {
    if (shouldPauseGraph()) {
      return { ok: false, error: 'Facebook tam dung goi API vi gan dat gioi han.', retryable: true };
    }
    const response = await graphGet(url, accessToken);
    const body = (await response.json().catch(() => ({}))) as {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      error?: Record<string, unknown>;
    };
    if (!response.ok || body.error) {
      const code = Number(body.error?.code ?? 0);
      const err = formatGraphError(body);
      noteGraphError(err, code);
      const retryable = response.status === 429 || RATE_LIMIT_CODES.has(code);
      if (retryable && hop < 3) {
        await sleep(2000 * (hop + 1));
        continue;
      }
      // Invalid field — retry once without optional fields
      const msg = String(body.error?.message ?? '');
      if (msg.includes('inline_link_clicks') || msg.includes('video_')) {
        const slim = BASE_FIELDS.replace(/inline_link_clicks,?/, '').replace(/,?cpp/, '');
        params.set('fields', slim);
        url = `https://graph.facebook.com/${GRAPH_VER}/${act}/insights?${params.toString()}`;
        continue;
      }
      return { ok: false, error: err, retryable };
    }
    for (const raw of body.data ?? []) {
      const normalized = normalizeGraphInsightRow(raw, level);
      if (normalized) rows.push(normalized);
    }
    const next = body.paging?.next ?? '';
    url = next.startsWith('https://graph.facebook.com/') ? next : '';
  }
  return { ok: true, rows };
}

export async function fetchInsightsForWindow(
  accessToken: string,
  accountDigits: string,
  level: InsightLevel,
  since: string,
  until: string,
): Promise<GraphFetchResult> {
  return fetchPagedInsights(accessToken, accountDigits, level, since, until);
}

export type BreakdownRow = {
  external_campaign_id: string;
  performance_date: string;
  breakdown_type: BreakdownType;
  breakdown_value: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads_platform: number;
  raw_insights: Record<string, unknown>;
};

const BREAKDOWN_FIELDS =
  'spend,impressions,clicks,reach,campaign_id,campaign_name,date_start,date_stop';

async function fetchPagedInsightsRaw(
  accessToken: string,
  accountDigits: string,
  level: InsightLevel,
  since: string,
  until: string,
  fields: string,
  extraParams: Record<string, string> = {},
): Promise<GraphFetchResult & { raw?: Array<Record<string, unknown>> }> {
  const act = `act_${accountDigits}`;
  const params = new URLSearchParams({
    fields,
    level,
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    ...extraParams,
  });
  let url = `https://graph.facebook.com/${GRAPH_VER}/${act}/insights?${params.toString()}`;
  const rawRows: Array<Record<string, unknown>> = [];
  const normalized: NormalizedInsightRow[] = [];

  for (let hop = 0; hop < 200 && url; hop += 1) {
    if (shouldPauseGraph()) {
      return { ok: false, error: 'Facebook tam dung goi API vi gan dat gioi han.', retryable: true };
    }
    const response = await graphGet(url, accessToken);
    const body = (await response.json().catch(() => ({}))) as {
      data?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      error?: Record<string, unknown>;
    };
    if (!response.ok || body.error) {
      return { ok: false, error: formatGraphError(body) };
    }
    for (const raw of body.data ?? []) {
      rawRows.push(raw);
      const n = normalizeGraphInsightRow(raw, level);
      if (n) normalized.push(n);
    }
    const next = body.paging?.next ?? '';
    url = next.startsWith('https://graph.facebook.com/') ? next : '';
  }
  return { ok: true, rows: normalized, raw: rawRows };
}

export async function fetchBreakdownForWindow(
  accessToken: string,
  accountDigits: string,
  breakdownType: BreakdownType,
  since: string,
  until: string,
): Promise<{ ok: true; rows: BreakdownRow[] } | { ok: false; error: string }> {
  const extra = { breakdowns: graphBreakdownsParam(breakdownType) };
  const result = await fetchPagedInsightsRaw(
    accessToken,
    accountDigits,
    'campaign',
    since,
    until,
    BREAKDOWN_FIELDS,
    extra,
  );
  if (!result.ok) return result;
  const rows: BreakdownRow[] = [];
  for (const raw of result.raw ?? []) {
    const campaign_id = String(raw.campaign_id ?? '').trim();
    const day = String(raw.date_start ?? '').slice(0, 10);
    if (!campaign_id || !day) continue;
    let breakdown_value: string;
    if (breakdownType === 'platform_position') {
      const pos = String(raw.platform_position ?? '').trim();
      const pub = String(raw.publisher_platform ?? '').trim();
      breakdown_value = (pub && pos ? `${pub}:${pos}` : pos || 'unknown').slice(0, 64);
    } else {
      breakdown_value = String(raw[breakdownType] ?? 'unknown').slice(0, 64);
    }
    rows.push({
      external_campaign_id: campaign_id,
      performance_date: day,
      breakdown_type: breakdownType,
      breakdown_value,
      spend: Number(raw.spend ?? 0) || 0,
      impressions: Math.trunc(Number(raw.impressions ?? 0) || 0),
      clicks: Math.trunc(Number(raw.clicks ?? 0) || 0),
      leads_platform: 0,
      raw_insights: raw,
    });
  }
  return { ok: true, rows };
}

export async function fetchAllBreakdowns(
  accessToken: string,
  accountDigits: string,
  since: string,
  until: string,
): Promise<{ rows: BreakdownRow[]; errors: string[] }> {
  const rows: BreakdownRow[] = [];
  const errors: string[] = [];
  for (const t of BREAKDOWN_TYPES) {
    const out = await fetchBreakdownForWindow(accessToken, accountDigits, t, since, until);
    if (!out.ok) {
      errors.push(`${t}: ${out.error}`);
      continue;
    }
    rows.push(...out.rows);
  }
  return { rows, errors };
}
