export type TrackingActualInput = {
  id: string;
  instance_id: string;
  period_end: string;
  quality_status: string;
  collection_method: string;
  source_ref: string;
  created_at?: string | null;
};

export type TrackingSummaryResult = {
  today_total: number;
  verified_pct: number;
  api_connector_total: number;
  api_connector_hint: string;
  manual_import_total: number;
  pending_verify: number;
  data_issues: number;
  stale_count: number;
  duplicate_count: number;
};

function isToday(isoDate: string, today: string, createdAt?: string | null): boolean {
  if (isoDate.slice(0, 10) === today) return true;
  if (createdAt && createdAt.slice(0, 10) === today) return true;
  return false;
}

function isApiConnector(method: string, sourceRef: string): boolean {
  const m = method.toLowerCase();
  if (m === 'api' || m === 'connector' || m === 'webhook') return true;
  const ref = sourceRef.toLowerCase();
  return /meta|ga4|google|crm|ads|connector|api/.test(ref);
}

function topSourceHints(actuals: TrackingActualInput[]): string {
  const counts = new Map<string, number>();
  for (const row of actuals) {
    if (!isApiConnector(row.collection_method, row.source_ref)) continue;
    const key = row.source_ref.trim() || row.collection_method || 'API';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return top.length ? top.map(([k]) => k).join(', ') : 'Meta, GA4, CRM';
}

export function aggregateTrackingSummary(input: {
  actuals: TrackingActualInput[];
  staleCount: number;
  duplicateCount: number;
  today?: string;
}): TrackingSummaryResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const open = input.actuals.filter((a) => a.id);
  const todayRows = open.filter((a) => isToday(a.period_end, today, a.created_at));
  const validRows = open.filter((a) => a.quality_status === 'valid');
  const pendingRows = open.filter((a) => a.quality_status === 'pending_validation');
  const invalidRows = open.filter((a) => a.quality_status === 'invalid' || a.quality_status === 'estimated');
  const apiRows = open.filter((a) => isApiConnector(a.collection_method, a.source_ref));
  const manualRows = open.filter((a) => !isApiConnector(a.collection_method, a.source_ref));

  const verifiedPct = open.length ? Math.round((validRows.length / open.length) * 1000) / 10 : 0;

  return {
    today_total: todayRows.length,
    verified_pct: verifiedPct,
    api_connector_total: apiRows.length,
    api_connector_hint: topSourceHints(open),
    manual_import_total: manualRows.length,
    pending_verify: pendingRows.length,
    data_issues: pendingRows.length + invalidRows.length + input.staleCount + input.duplicateCount,
    stale_count: input.staleCount,
    duplicate_count: input.duplicateCount,
  };
}
