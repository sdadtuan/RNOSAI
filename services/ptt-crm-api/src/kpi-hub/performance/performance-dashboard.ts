export type DashRow = {
  lifecycle: 'draft' | 'active' | 'tracking' | 'closed';
  status: 'green' | 'yellow' | 'red' | 'no_data';
  quality: 'verified' | 'pending' | 'stale';
  assumption_open: boolean;
};

export function computeDashboardTiles(input: {
  rows: DashRow[];
  item_scores: Array<number | null>;
  checkins_expected: number;
  checkins_on_time: number;
}) {
  const live = input.rows.filter((r) => r.lifecycle === 'active' || r.lifecycle === 'tracking');
  const scores = input.item_scores.filter((s): s is number => s != null);
  const completion =
    scores.length === 0 ? 0 : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return {
    on_track: live.filter((r) => r.status === 'green' && r.quality !== 'stale' && !r.assumption_open).length,
    watch: live.filter((r) => r.status === 'yellow' || r.assumption_open).length,
    off_track: live.filter((r) => r.status === 'red').length,
    total: live.length,
    data_blocked: live.filter((r) => r.quality === 'pending' || r.quality === 'stale').length,
    completion_pct: completion,
    checkin_on_time_pct:
      input.checkins_expected === 0
        ? 0
        : Math.round((input.checkins_on_time / input.checkins_expected) * 1000) / 10,
  };
}

export function buildWeeklyRhythm(input: {
  open_assumptions: string[];
  at_risk: string[];
  stale_label: string;
  gm_miss: string;
  pending_scorecard: string;
}) {
  return [
    { id: 'assumption', title: 'Assumption chưa confirm', body: input.open_assumptions.join(' · '), href: '/crm/kpi-hub/performance/check-ins' },
    { id: 'at_risk', title: 'At-risk + action quá hạn', body: input.at_risk.join(' · '), href: '/crm/kpi-hub/performance/assignments' },
    { id: 'stale', title: 'Data stale → cấm báo cáo khách', body: input.stale_label, href: '/crm/kpi-hub/performance/crm-source' },
    { id: 'gm', title: 'Lệch KPI + GM', body: input.gm_miss, href: '/crm/kpi-hub/kpi-contracts' },
    { id: 'scorecard', title: 'Scorecard pending', body: input.pending_scorecard, href: '/crm/kpi-hub/performance/scorecards' },
  ];
}
