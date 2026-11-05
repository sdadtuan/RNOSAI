export type QualityOverviewShape = {
  score: number | null;
  freshness: Array<{
    system: string;
    status: string;
    last_success_at: string | null;
  }>;
};

export type ApprovalQueueInput = {
  dictionary: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    tech_preview?: string | null;
  }>;
  targets: Array<{ id: string; status: string; dictionary_code?: string }>;
  reports: Array<{ id: string; status: string; name: string }>;
};

const DEFAULT_SYSTEMS = ['CRM', 'META_ADS', 'SHAREPOINT', 'ERP'] as const;
const MARKETING_EXTRA = ['GA4'] as const;

export function buildDataTrust(
  overview: QualityOverviewShape,
  options?: { includeGa4?: boolean },
): { score: number | null; sources: Array<{ system: string; status: string; last_success_at: string | null }> } {
  const systems = options?.includeGa4 ? [...DEFAULT_SYSTEMS, ...MARKETING_EXTRA] : [...DEFAULT_SYSTEMS];
  const freshnessMap = new Map(overview.freshness.map((f) => [f.system, f]));

  const sources = systems.map((system) => {
    const row = freshnessMap.get(system);
    if (row) {
      return {
        system,
        status: row.status,
        last_success_at: row.last_success_at,
      };
    }
    return { system, status: 'UNKNOWN', last_success_at: null };
  });

  return { score: overview.score, sources };
}

export function buildApprovalQueue(input: ApprovalQueueInput): {
  kpi_count: number;
  target_count: number;
  mapping_count: number;
  recent: Array<{ id: string; kind: string; label: string }>;
} {
  const kpiPending = input.dictionary.filter((d) => d.status === 'PENDING_APPROVAL');
  const targetPending = input.targets.filter((t) => t.status === 'PENDING_APPROVAL');
  const mappingGaps = input.dictionary.filter(
    (d) => d.status === 'NEED_REVIEW' && (d.tech_preview == null || d.tech_preview === ''),
  );
  const reportPending = input.reports.filter((r) => r.status === 'PENDING_APPROVAL');

  const recent: Array<{ id: string; kind: string; label: string }> = [];
  for (const d of kpiPending) {
    recent.push({ id: d.id, kind: 'kpi', label: `${d.code} — ${d.name}` });
  }
  for (const t of targetPending) {
    recent.push({ id: t.id, kind: 'target', label: t.dictionary_code ?? t.id });
  }
  for (const r of reportPending) {
    recent.push({ id: r.id, kind: 'report', label: r.name });
  }

  return {
    kpi_count: kpiPending.length,
    target_count: targetPending.length,
    mapping_count: mappingGaps.length,
    recent: recent.slice(0, 3),
  };
}
