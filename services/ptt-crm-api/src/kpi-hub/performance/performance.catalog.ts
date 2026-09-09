import { isMaterialQuotedDelta, quotedDeltaPct } from './performance-ledgers';
import { healthFromDirection, progressPercent, validateScorecardWeights } from './performance-score';
import type { PmAssignment, PmCatalog, PmScorecard } from './performance.types';

type AssignmentSeed = Partial<
  Omit<
    PmAssignment,
    | 'assigned_target'
    | 'quoted_vs_assigned_pct'
    | 'quoted_vs_actual_pct'
    | 'quoted_delta_material'
    | 'actual_locked'
  >
> &
  Pick<PmAssignment, 'id' | 'name' | 'code' | 'definition_code' | 'owner' | 'scope_type' | 'scope_name' | 'target' | 'direction' | 'quality'>;

function withDefaults(row: AssignmentSeed): Omit<PmAssignment, 'progress' | 'status'> {
  const { progress: _p, status: _s, ...seed } = row;
  const assigned_target = seed.target;
  const collection_method = seed.collection_method ?? 'manual';
  const auto = collection_method === 'api' || collection_method === 'connector';
  const quoted_target = seed.quoted_target ?? null;
  const actual = seed.actual ?? null;
  const quoted_vs_assigned_pct = quotedDeltaPct(quoted_target, assigned_target);
  const quoted_vs_actual_pct = quotedDeltaPct(quoted_target, actual);
  return {
    department: seed.department ?? seed.scope_name,
    cycle: seed.cycle ?? 'Tháng',
    period: seed.period ?? '09/2026',
    target_label: seed.target_label ?? String(seed.target),
    unit: seed.unit ?? '',
    trend: seed.trend ?? 'na',
    source: seed.source ?? 'Manual',
    quoted_target,
    source_id: seed.source_id ?? null,
    instance_id: seed.instance_id ?? null,
    collection_method,
    lifecycle: seed.lifecycle ?? 'tracking',
    client_visible: seed.client_visible ?? false,
    disclaimer: seed.disclaimer ?? '',
    assumption_open: seed.assumption_open ?? false,
    target_min: seed.target_min ?? null,
    target_stretch: seed.target_stretch ?? null,
    row_version: seed.row_version ?? 1,
    assigned_target,
    quoted_vs_assigned_pct,
    quoted_vs_actual_pct,
    quoted_delta_material: isMaterialQuotedDelta(quoted_vs_assigned_pct),
    actual_locked: seed.quality === 'verified' && auto,
    actual,
    ...seed,
  };
}

function withCalc(row: AssignmentSeed): PmAssignment {
  const progressOverride = row.progress;
  const statusOverride = row.status;
  const base = withDefaults(row);
  const progress =
    progressOverride ??
    progressPercent({ actual: base.actual, target: base.target, direction: base.direction });
  return {
    ...base,
    progress,
    status:
      statusOverride ??
      healthFromDirection({ actual: base.actual, target: base.target, direction: base.direction, progress }),
  };
}

const assignments: PmAssignment[] = [
  withCalc({
    id: 'asg-mql',
    name: 'Số lead đủ điều kiện',
    code: 'KPI-SALES-LEAD-001',
    definition_code: 'SAL_014',
    owner: 'Nguyễn Minh Anh',
    scope_type: 'department',
    scope_name: 'Sales',
    department: 'Sales',
    cycle: 'Tháng',
    period: '09/2026',
    direction: 'higher',
    target: 1000,
    target_label: '1.000',
    actual: 720,
    unit: 'Lead',
    trend: 'down',
    source: 'CRM — Lead đã xác thực',
    quality: 'verified',
  }),
  withCalc({
    id: 'asg-cpa',
    name: 'CPA Meta Ads',
    code: 'KPI-MKT-CPA-001',
    definition_code: 'MKT_012',
    owner: 'Lê Hoàng',
    scope_type: 'client',
    scope_name: 'Spa ABC',
    department: 'Performance',
    cycle: 'Tháng',
    period: '09/2026',
    direction: 'lower',
    target: 160000,
    target_label: '≤160K',
    actual: 149000,
    unit: 'VND',
    trend: 'up',
    source: 'Meta Ads API',
    quality: 'verified',
    collection_method: 'api',
  }),
  withCalc({
    id: 'asg-ontime',
    name: 'Tỷ lệ bàn giao đúng hạn',
    code: 'KPI-CNT-SLA-001',
    definition_code: 'CNT_003',
    owner: 'Team Content',
    scope_type: 'team',
    scope_name: 'Marketing',
    department: 'Content',
    cycle: 'Tuần',
    period: 'W36',
    direction: 'higher',
    target: 95,
    target_label: '95%',
    actual: 85,
    unit: '%',
    trend: 'down',
    source: 'Project Management',
    quality: 'verified',
  }),
  withCalc({
    id: 'asg-roas',
    name: 'ROAS Google Ads',
    code: 'KPI-MKT-ROAS-001',
    definition_code: 'MKT_021',
    owner: 'Đỗ Minh Khang',
    scope_type: 'department',
    scope_name: 'Performance',
    department: 'Performance',
    cycle: 'Tháng',
    period: '09/2026',
    direction: 'higher',
    target: 4.5,
    target_label: '450%',
    actual: 5.12,
    unit: 'x',
    trend: 'up',
    source: 'Google Ads + Attribution',
    quality: 'verified',
  }),
  withCalc({
    id: 'asg-cpl',
    name: 'CPL Valid Lead · An Phát',
    code: 'KPI-MKT-CPL-089',
    definition_code: 'MKT_006',
    owner: 'Lê Hoàng',
    scope_type: 'campaign',
    scope_name: 'Growth Launch Q4',
    department: 'Performance',
    cycle: 'Tháng',
    period: '09/2026',
    direction: 'lower',
    target: 100000,
    target_label: '≤100K',
    actual: 128000,
    unit: 'VND',
    trend: 'down',
    source: 'Meta Ads + CRM',
    quality: 'stale',
    status: 'red',
    quoted_target: 100000,
    assumption_open: true,
  }),
  withCalc({
    id: 'asg-p1',
    name: 'Thời gian xử lý lỗi P1',
    code: 'KPI-TEC-P1-001',
    definition_code: 'TEC_008',
    owner: 'Trần Văn Nam',
    scope_type: 'department',
    scope_name: 'Technology',
    department: 'Technology',
    cycle: 'Tuần',
    period: 'W36',
    direction: 'lower',
    target: 4,
    target_label: '≤ 4h',
    actual: 5.2,
    unit: 'giờ',
    trend: 'down',
    source: 'Incident Dashboard',
    quality: 'verified',
  }),
];

function scorecardOf(items: PmScorecard['items']): PmScorecard {
  const { total, valid } = validateScorecardWeights(items.map((i) => i.weight));
  return {
    id: 'sc-mkt-lead-q4',
    title: 'KPI Q4/2026 – Marketing Lead',
    owner: 'Nguyễn Minh Anh — Marketing Leader',
    department: 'Marketing',
    period: '01/10/2026–31/12/2026',
    cycle: 'Quý',
    approver: 'Giám đốc Marketing',
    status: 'pending',
    items,
    weight_total: total,
    weight_valid: valid,
  };
}

export function seedPerformanceCatalog(): PmCatalog {
  const scorecard = scorecardOf([
    { id: 'it-mql', name: 'Marketing Qualified Leads', definition_code: 'MKT_007', weight: 30, target_label: '1.200', unit: 'Leads', formula: 'COUNT(leads WHERE lifecycle_stage = MQL)', owner: 'Nguyễn Minh Anh' },
    { id: 'it-cpl', name: 'Cost per Lead', definition_code: 'MKT_006', weight: 20, target_label: '≤85.000', unit: 'VND', formula: 'Spend / Valid Leads', owner: 'Lê Hoàng' },
    { id: 'it-sql', name: 'Tỷ lệ MQL → SQL', definition_code: 'SAL_022', weight: 20, target_label: '≥18%', unit: '%', formula: 'SQL / MQL', owner: 'Nguyễn Minh Anh' },
    { id: 'it-rev', name: 'Doanh thu ảnh hưởng MKT', definition_code: 'FIN_011', weight: 20, target_label: '2,5 tỷ', unit: 'VND', formula: 'Attribution model', owner: 'Finance + MKT' },
    { id: 'it-ontime', name: 'Campaign đúng hạn', definition_code: 'CNT_003', weight: 10, target_label: '≥95%', unit: '%', formula: 'On-time / Total', owner: 'PMO' },
  ]);

  const cpl = assignments.find((a) => a.id === 'asg-cpl')!;
  const ledgers = {
    quoted: { value: cpl.quoted_target, label: 'Quoted', hint: 'Proposal QT-0089' },
    assigned: { value: cpl.assigned_target, label: 'Assigned', hint: 'Scorecard Q4' },
    verified: { value: cpl.quality === 'verified' ? cpl.actual : null, label: cpl.quality === 'verified' ? 'Verified' : 'Pending', hint: cpl.quality === 'stale' ? 'Stale 29h' : '' },
  };

  return {
    dashboard: {
      on_track: 42,
      watch: 11,
      off_track: 5,
      total: 58,
      completion_pct: 82.4,
      checkin_on_time_pct: 91,
      data_blocked: 0,
      ledgers,
      rhythm: [],
      dept_scores: [
        { department: 'Marketing', score: 86, status: 'green' },
        { department: 'Sales', score: 78, status: 'yellow' },
        { department: 'Content', score: 91, status: 'green' },
        { department: 'Performance', score: 84, status: 'green' },
        { department: 'Technology', score: 69, status: 'red' },
      ],
      queue: [
        { title: 'CPL Valid Lead · An Phát', badge: 'Critical', href: '/crm/kpi-hub/performance/check-ins?id=asg-cpl' },
        { title: '06 check-in quá hạn', badge: 'Review', href: '/crm/kpi-hub/performance/check-ins' },
        { title: 'CRM data freshness stale', badge: '29h', href: '/crm/kpi-hub/performance/crm-source' },
        { title: 'Scorecard Q4/2026 pending', badge: '02', href: '/crm/kpi-hub/performance/scorecards' },
      ],
    },
    assignments,
    scorecards: [scorecard],
    checkins: [
      { id: 'ck-1', assignment_id: 'asg-p1', date: '07/09', author: 'Trần Văn Nam', status: 'red', note: '03 blocker P1 chưa xử lý; cần Platform Team hỗ trợ.', forecast: '4,8 giờ', evidence: 'Incident dashboard' },
      { id: 'ck-2', assignment_id: 'asg-p1', date: '31/08', author: 'Trần Văn Nam', status: 'yellow', note: 'Actual 4,5 giờ; đang phân tích root cause.', evidence: 'Ticket P1' },
      { id: 'ck-3', assignment_id: 'asg-p1', date: '24/08', author: 'Team Lead', status: 'approved', note: 'Đã xác nhận dữ liệu từ Incident Dashboard.' },
    ],
    actions: [
      { id: 'ac-1', assignment_id: 'asg-p1', title: 'Xử lý 03 blocker P1 ưu tiên cao', owner: 'Trần Văn Nam', due: '10/09/2026 17:00', impact: 'Giảm P1 về dưới 4 giờ' },
    ],
    campaigns: [
      { campaign: 'Growth Launch Q4', client: 'Công ty An Phát', quote_wo: 'QT-0089', kpi: 'CPL Valid Lead', quoted: '≤100K', actual: '128K', media_budget: '100M', agency_fee: '20M', status: 'red' },
      { campaign: 'Spa Lead Growth', client: 'Spa ABC', quote_wo: 'QT-0042', kpi: 'Booking Rate', quoted: '≥22%', actual: '24,1%', media_budget: '72M', agency_fee: '18M', status: 'green' },
      { campaign: 'Student Recruitment', client: 'EduNext', quote_wo: 'QT-0067', kpi: 'Qualified Lead', quoted: '1.200', actual: '860', media_budget: '96M', agency_fee: '24M', status: 'yellow' },
    ],
    crm_mappings: [
      { kpi: 'Valid Lead', definition: 'is_valid ∧ dedup · v3', field: 'lead.status', cadence: 'Hourly', quality: 'Stale 29h', related: 'CPL Valid Lead' },
      { kpi: 'MQL', definition: 'lifecycle_stage=MQL', field: 'lead.lifecycle_stage', cadence: 'Hourly', quality: 'Verified', related: 'MQL Target / MQL Rate' },
      { kpi: 'SQL', definition: 'Sales Qualified Lead', field: 'lead.lifecycle_stage', cadence: 'Daily', quality: 'Verified', related: 'MQL → SQL Rate' },
      { kpi: 'First Response', definition: 'first_contact_at - created_at', field: 'activity.created_at', cadence: 'Hourly', quality: 'Verified', related: 'Lead Response SLA' },
    ],
    settings: {
      score_cap: '100',
      weight_must_100: true,
      green_min: 90,
      yellow_min: 70,
      lower_red_rule: 'Actual > target (lower-is-better)',
      reminder: 'T-1 ngày, ngày đến hạn',
      escalation: 'Owner → Team Lead → Department Head',
      stale_action: 'Mark Pending Validation + Alert',
      period_close: 'Manager approval + immutable snapshot',
      default_source: 'KPI Hub / Measurement Plan',
      client_visibility: 'Only client_visible snapshot from Proposal/Project',
      effective_at: '01/10/2026',
      impact: { scorecards: 1, assignments: assignments.length, snapshots_untouched: true },
    },
    marketing: {
      spend: '324,8M ₫',
      valid_leads: 3248,
      cpl: 99900,
      mql_rate: 18.6,
      roas: { value: null, display: 'N/A', reason: 'Thiếu attribution model' },
      attribution_ready: false,
      sources: [
        { name: 'Meta Ads', health: 'Healthy' },
        { name: 'Google Ads', health: 'Healthy' },
        { name: 'CRM Valid Lead', health: 'Stale 29h' },
        { name: 'GA4', health: 'Healthy' },
      ],
      at_risk: [
        { title: 'CPL Valid Lead · An Phát', actual: '128K / 100K', status: 'red' },
        { title: 'Creative delivery · Spa ABC', actual: '75% / 90%', status: 'yellow' },
        { title: 'SEO Index Coverage · EduNext', actual: '89% / 95%', status: 'yellow' },
      ],
    },
    reports: {
      completion_pct: 82.4,
      compliance_pct: 91,
      at_risk_pct: 19,
      overdue_checkins: 6,
      snapshots: 0,
      scorecards_active: 23,
      period_state: 'open',
      by_scope: [
        { scope: 'Cá nhân', healthy_pct: 84 },
        { scope: 'Team', healthy_pct: 81 },
        { scope: 'Phòng ban', healthy_pct: 77 },
        { scope: 'Dự án/Khách hàng', healthy_pct: 74 },
      ],
    },
    snapshots: [],
    audit_logs: [],
  };
}
