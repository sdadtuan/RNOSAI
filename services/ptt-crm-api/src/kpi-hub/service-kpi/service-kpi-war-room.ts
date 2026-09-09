export type WarRoomInput = {
  instances: Array<{
    id: string;
    dv_code: string | null;
    status: string;
    assumption_state: string;
    classification: string;
    client_visible: boolean;
    target_max: number | null;
    latest_actual: number | null;
  }>;
  actuals_pending: number;
  quotes_high_score: number;
  gm_by_dv: Array<{ dv_code: string; gm_pct: number | null }>;
  include_gm: boolean;
};

export type WarRoomResponse = {
  critical_overdue: number;
  assumptions_open: number;
  blocked_reports: number;
  quotes_score_gte_70: number;
  queue: Array<{ title: string; subtitle: string; href: string; badge: string }>;
  dv_health: Array<{ dv_code: string; kpi_health_pct: number; gm_pct: number | null }>;
};

export function buildWarRoom(input: WarRoomInput): WarRoomResponse {
  const atRisk = input.instances.filter((i) => i.status === 'AT_RISK');
  const assumptionsOpen = input.instances.filter((i) => i.assumption_state === 'not_met' || i.assumption_state === 'pending').length;
  const blockedReports = input.actuals_pending;
  const queue: WarRoomResponse['queue'] = [];

  for (const inst of input.instances.filter((i) => i.assumption_state === 'not_met')) {
    queue.push({
      title: `Assumption chưa đạt · ${inst.dv_code ?? '—'}`,
      subtitle: inst.id,
      href: `/crm/kpi-hub/instances`,
      badge: 'Assumption',
    });
  }
  for (const inst of atRisk) {
    queue.push({
      title: `KPI at-risk · ${inst.dv_code ?? '—'}`,
      subtitle: inst.classification,
      href: `/crm/kpi-hub/instances?status=AT_RISK`,
      badge: 'At-risk',
    });
  }
  if (blockedReports > 0) {
    queue.push({
      title: 'Actual pending chặn Reported',
      subtitle: `${blockedReports} bản ghi`,
      href: '/crm/kpi-hub/reconcile',
      badge: 'Blocked',
    });
  }

  const dvMap = new Map<string, { ok: number; total: number }>();
  for (const inst of input.instances) {
    const dv = inst.dv_code ?? 'UNKNOWN';
    const cur = dvMap.get(dv) ?? { ok: 0, total: 0 };
    cur.total += 1;
    if (inst.status !== 'AT_RISK' && inst.status !== 'MISSED') cur.ok += 1;
    dvMap.set(dv, cur);
  }
  const gmMap = new Map(input.gm_by_dv.map((g) => [g.dv_code, g.gm_pct]));
  const dv_health = [...dvMap.entries()].map(([dv_code, stats]) => ({
    dv_code,
    kpi_health_pct: stats.total ? Math.round((stats.ok / stats.total) * 100) : 0,
    gm_pct: input.include_gm ? (gmMap.get(dv_code) ?? null) : null,
  }));

  return {
    critical_overdue: atRisk.length,
    assumptions_open: assumptionsOpen,
    blocked_reports: blockedReports,
    quotes_score_gte_70: input.quotes_high_score,
    queue,
    dv_health,
  };
}
