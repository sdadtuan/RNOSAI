export const QT_KPI_CLASSES = [
  'committed',
  'optimization_target',
  'projected_result',
  'assumption_input',
] as const;

export type QtKpiClass = (typeof QT_KPI_CLASSES)[number];

export type QtQuoteKpiRow = {
  name?: string | null;
  class?: string | null;
  value_text?: string | null;
  source?: string | null;
  assumption?: string | null;
};

export type QtMetaFunnelValues = {
  impressions: string | null;
  clicks: string | null;
  leads: string | null;
  sql: string | null;
  ctr: string | null;
  cvr: string | null;
  cpl: string | null;
};

const EMPTY_FUNNEL: QtMetaFunnelValues = {
  impressions: null,
  clicks: null,
  leads: null,
  sql: null,
  ctr: null,
  cvr: null,
  cpl: null,
};

const FUNNEL_NAME_KEYS: Record<string, keyof QtMetaFunnelValues> = {
  imp: 'impressions',
  impression: 'impressions',
  impressions: 'impressions',
  click: 'clicks',
  clicks: 'clicks',
  lead: 'leads',
  leads: 'leads',
  sql: 'sql',
  ctr: 'ctr',
  cvr: 'cvr',
  conversion: 'cvr',
  conversionrate: 'cvr',
  cpl: 'cpl',
};

export function isProjectedResult(row: { class?: string | null } | null | undefined): boolean {
  return String(row?.class ?? '').trim().toLowerCase() === 'projected_result';
}

function normalizeKpiName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function funnelKeyForName(name: string): keyof QtMetaFunnelValues | null {
  const normalized = normalizeKpiName(name);
  if (FUNNEL_NAME_KEYS[normalized]) return FUNNEL_NAME_KEYS[normalized];
  return FUNNEL_NAME_KEYS[normalized.replace(/s$/, '')] ?? null;
}

export function funnelFromProjectedKpis(kpis: QtQuoteKpiRow[] | null | undefined): QtMetaFunnelValues {
  const funnel: QtMetaFunnelValues = { ...EMPTY_FUNNEL };
  for (const row of kpis ?? []) {
    if (!isProjectedResult(row)) continue;
    const key = funnelKeyForName(String(row.name ?? ''));
    if (!key || funnel[key] != null) continue;
    const value = String(row.value_text ?? '').trim();
    funnel[key] = value || null;
  }
  return funnel;
}
